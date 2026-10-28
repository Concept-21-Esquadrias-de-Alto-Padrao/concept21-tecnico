begin;
-- Reuse the multi-piece relation already present in the earlier test delivery.
create table if not exists public.technical_action_pieces (
 action_id uuid not null references public.technical_actions(id) on delete cascade,
 piece_id uuid not null references public.technical_contract_pieces(id) on delete restrict,
 created_at timestamptz not null default now(), primary key(action_id,piece_id)
);
create index if not exists technical_action_pieces_piece_idx on public.technical_action_pieces(piece_id);
alter table public.technical_action_pieces enable row level security;
-- Server actions enforce the same tenant/permissions as the rest of this module.
grant select,insert on public.technical_action_pieces to service_role;

create or replace function public.technical_save_alignment(p_company uuid,p_contract uuid,p_profile uuid,p_user uuid,p_version integer,p_finish boolean,p_draft jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 t public.technical_contracts%rowtype; old_state jsonb; next_state jsonb; task jsonb; pid text;
 meeting_uuid uuid; action_uuid uuid; owner_uuid uuid; piece_count integer; piece_labels text; new_version integer;
begin
 select * into t from public.technical_contracts where company_id=p_company and contract_id=p_contract and deleted_at is null for update;
 if not found then raise exception 'Obra não encontrada.'; end if;
 if not exists(select 1 from public.profiles where id=p_profile and company_id=p_company and user_id=p_user and status='active') then raise exception 'Usuário inválido.'; end if;
 if not exists(select 1 from public.production_contracts where id=p_contract and company_id=p_company and active) then raise exception 'Obra inativa.';end if;
 old_state:=coalesce(t.commercial_data->'alignment','{}'::jsonb);
 if old_state->>'status'='completed' and t.technical_status<>'aguardando_reuniao' then return old_state; end if;
 if t.technical_status<>'aguardando_reuniao' or exists(select 1 from public.technical_closing_meetings where company_id=p_company and contract_id=p_contract and status='concluida') then raise exception 'Reunião já concluída. Reabra a etapa com motivo para alterar.';end if;
 if t.commercial_data->'receipt' is not null and t.commercial_data->'receipt'->>'status' is distinct from 'completed' then raise exception 'Conclua a conferência do recebimento antes da reunião.';end if;
 if coalesce((old_state->>'version')::integer,0)<>p_version then raise exception 'Outra pessoa atualizou esta reunião. Reabra a página para preservar os dados.';end if;
 if jsonb_typeof(p_draft->'tasks') is distinct from 'array' or jsonb_array_length(p_draft->'tasks')>100 then raise exception 'Lista de atividades inválida.';end if;
 if p_finish and (nullif(trim(p_draft->>'participants'),'') is null or nullif(p_draft->>'date','') is null) then raise exception 'Informe data e participantes.';end if;
 if p_finish and exists(select 1 from jsonb_array_elements(p_draft->'tasks') x group by x->>'id' having count(*)>1) then raise exception 'Atividades repetidas.';end if;
 for task in select value from jsonb_array_elements(p_draft->'tasks') loop
  if task->>'kind' not in ('correction','general') or task->>'block' not in ('none','entrada_inicial','visitas','liberacao_peca','prods') then raise exception 'Tipo de atividade ou bloqueio inválido.';end if;
  if p_finish and (nullif(trim(task->>'description'),'') is null or nullif(task->>'owner','') is null or nullif(task->>'due','') is null) then raise exception 'Toda atividade precisa de descrição, responsável e prazo.';end if;
  if nullif(task->>'owner','') is not null and not exists(select 1 from public.profiles where id=(task->>'owner')::uuid and company_id=p_company and status='active') then raise exception 'Responsável não está ativo nesta empresa.';end if;
  piece_count:=jsonb_array_length(task->'pieceIds');
  if task->>'kind'='general' and piece_count>0 then raise exception 'Ação geral não deve conter peças.';end if;
  if p_finish and task->>'kind'='correction' and piece_count=0 then raise exception 'Selecione as peças da correção.';end if;
  for pid in select jsonb_array_elements_text(task->'pieceIds') loop
   if not exists(select 1 from public.technical_contract_pieces where id=pid::uuid and company_id=p_company and contract_id=p_contract and deleted_at is null and status<>'cancelada') then raise exception 'Peça indisponível ou vinculada a outra obra.';end if;
  end loop;
 end loop;
 new_version:=p_version+1;
 next_state:=jsonb_build_object('version',new_version,'status',case when p_finish then 'completed' else 'draft' end,'draft',p_draft,'updatedAt',now(),'updatedBy',p_profile);
 if p_finish then
  meeting_uuid:=gen_random_uuid();
  insert into public.technical_closing_meetings(id,company_id,contract_id,meeting_date,meeting_time,participants,summary,decisions,status,registered_by_profile_id)
  values(meeting_uuid,p_company,p_contract,(p_draft->>'date')::date,nullif(p_draft->>'time','')::time,regexp_split_to_array(trim(p_draft->>'participants'),E'[;\\n]+'),nullif(p_draft->>'summary',''),nullif(p_draft->>'decisions',''),'concluida',p_profile);
  for task in select value from jsonb_array_elements(p_draft->'tasks') loop
   action_uuid:=gen_random_uuid(); owner_uuid:=(task->>'owner')::uuid;
   select string_agg(code||' · '||coalesce(environment,'')||' · '||coalesce(piece_type,''), E'\n' order by code) into piece_labels from public.technical_contract_pieces where id in (select value::uuid from jsonb_array_elements_text(task->'pieceIds'));
   insert into public.technical_actions(id,company_id,contract_id,meeting_id,title,description,responsible_profile_id,due_date,priority,blocking,blocking_stage,status)
   values(action_uuid,p_company,p_contract,meeting_uuid,left(trim(task->>'description'),240),trim(task->>'description'),owner_uuid,(task->>'due')::date,'normal',task->>'block'<>'none',case when task->>'block'='none' then null else task->>'block' end,'aberta');
   insert into public.technical_action_pieces(action_id,piece_id) select action_uuid,value::uuid from jsonb_array_elements_text(task->'pieceIds') on conflict do nothing;
  end loop;
  next_state:=next_state||jsonb_build_object('meetingId',meeting_uuid);
 end if;
 update public.technical_contracts set commercial_data=coalesce(commercial_data,'{}'::jsonb)||jsonb_build_object('alignment',next_state),technical_status=case when p_finish then case when commercial_folder_received then 'em_acompanhamento' else 'aguardando_pasta' end else technical_status end where company_id=p_company and contract_id=p_contract;
 insert into public.audit_logs(company_id,entity,entity_id,action,user_id,before_data,after_data,notes) values(p_company,'technical_contracts',p_contract,case when p_finish then 'alignment_completed' else 'alignment_draft_saved' end,p_user,old_state,next_state,case when p_finish then 'Reunião de alinhamento concluída; atividades criadas em conjunto.' else 'Rascunho da reunião guardado.' end);
 return next_state;
end $$;
revoke all on function public.technical_save_alignment(uuid,uuid,uuid,uuid,integer,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.technical_save_alignment(uuid,uuid,uuid,uuid,integer,boolean,jsonb) to service_role;

-- These gates cover both UI and direct server writes. No existing approval is removed.
create or replace function public.technical_alignment_has_block(p_company uuid,p_contract uuid,p_stage text,p_piece uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from technical_actions a where a.company_id=p_company and a.contract_id=p_contract and a.deleted_at is null and a.blocking and a.status not in ('concluida','cancelada') and a.blocking_stage=p_stage and (p_piece is null or (not exists(select 1 from technical_action_pieces l where l.action_id=a.id) and (a.piece_id is null or a.piece_id=p_piece)) or exists(select 1 from technical_action_pieces l where l.action_id=a.id and l.piece_id=p_piece)))
$$;
revoke all on function public.technical_alignment_has_block(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.technical_alignment_has_block(uuid,uuid,text,uuid) to service_role;
create or replace function public.technical_alignment_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare cid uuid; coid uuid;
begin
 if TG_TABLE_NAME='technical_contracts' then
  if new.commercial_folder_received and not old.commercial_folder_received and technical_alignment_has_block(new.company_id,new.contract_id,'entrada_inicial') then raise exception 'Há uma atividade bloqueando a entrega da pasta. Conclua a atividade antes de entregar.';end if;
 elsif TG_TABLE_NAME='technical_visits' then
  if new.status='agendada' and technical_alignment_has_block(new.company_id,new.contract_id,'visitas') then raise exception 'Há uma atividade bloqueando o agendamento desta obra.';end if;
 elsif TG_TABLE_NAME='technical_contract_pieces' then
  if new.released_at is not null and old.released_at is null and technical_alignment_has_block(new.company_id,new.contract_id,'liberacao_peca',new.id) then raise exception 'Há uma atividade bloqueando a liberação desta peça.';end if;
  if new.active_prod_batch_id is not null and new.active_prod_batch_id is distinct from old.active_prod_batch_id and technical_alignment_has_block(new.company_id,new.contract_id,'prods',new.id) then raise exception 'Há uma atividade bloqueando a emissão de PROD desta peça.';end if;
 elsif TG_TABLE_NAME='technical_prod_batch_pieces' then
  select company_id,contract_id into coid,cid from technical_contract_pieces where id=new.piece_id;
  if technical_alignment_has_block(coid,cid,'prods',new.piece_id) then raise exception 'Há uma atividade bloqueando a emissão de PROD desta peça.';end if;
 end if;
 return new;
end $$;
create or replace trigger alignment_folder_guard before update of commercial_folder_received on public.technical_contracts for each row execute function public.technical_alignment_guard();
create or replace trigger alignment_visit_guard before insert or update of scheduled_date,status on public.technical_visits for each row execute function public.technical_alignment_guard();
create or replace trigger alignment_piece_guard before update of released_at,active_prod_batch_id on public.technical_contract_pieces for each row execute function public.technical_alignment_guard();
create or replace trigger alignment_prod_guard before insert or update of piece_id on public.technical_prod_batch_pieces for each row execute function public.technical_alignment_guard();
commit;
