begin;
-- Enable complete sets only. Partial issuance and cancellation require a separate reviewed flow.
alter table public.technical_fabrication_sets add column if not exists workflow_ready boolean not null default false;
create or replace function public.technical_prepare_fabrication_prod(co uuid,cid uuid,sid uuid,actor uuid)
returns uuid language plpgsql set search_path=public as $$
declare s technical_fabrication_sets%rowtype; b technical_prod_batches%rowtype; imp technical_fabrication_imports%rowtype; p technical_contract_pieces%rowtype; r technical_releases%rowtype; ids uuid[]; expected integer;
begin
 perform 1 from production_contracts where id=cid and company_id=co and active for update;
 if not found then raise exception 'Contrato indisponível.'; end if;
 select * into s from technical_fabrication_sets where id=sid and company_id=co and contract_id=cid for update;
 if not found then raise exception 'Conjunto indisponível.'; end if;
 select * into imp from technical_fabrication_imports where set_id=sid;
 if not found then raise exception 'Importe o relatório antes de encaminhar.'; end if;
 select * into b from technical_prod_batches where id=imp.prod_batch_id and company_id=co and contract_id=cid for update;
 if not found or b.deleted_at is not null or b.status='cancelado' then raise exception 'PROD indisponível.'; end if;
 if s.workflow_ready then return b.id; end if;
 if b.status<>'rascunho' then raise exception 'PROD precisa estar em rascunho.'; end if;
 if not exists(select 1 from audit_logs where company_id=co and entity_id=sid and entity='technical_fabrication_sets' and action='fabrication_scope_confirmed' and after_data->>'coverage'='total' and after_data->>'finishConfirmed'='true' and (after_data->>'setVersion')::integer=s.version) then raise exception 'Confirme cobertura integral e acabamento desta versão.'; end if;
 select array_agg(distinct piece_id) into ids from (select piece_id from technical_fabrication_set_sources where set_id=sid union select piece_id from technical_fabrication_items where import_id=imp.id and piece_id is not null) q;
 expected:=jsonb_array_length(s.draft->'contractCodes')+2;
 if cardinality(ids)<>expected or (select count(*) from technical_fabrication_items where import_id=imp.id)<>jsonb_array_length(s.draft->'fabricationCodes')+2 then raise exception 'Vínculos incompletos.'; end if;
 if exists(select 1 from technical_prod_batch_pieces where prod_batch_id=b.id and not(piece_id=any(ids))) then raise exception 'PROD possui peças fora do conjunto.'; end if;
 for p in select * from technical_contract_pieces where id=any(ids) order by id for update loop
  if p.company_id<>co or p.contract_id<>cid or p.deleted_at is not null or p.status<>'liberada' or p.released_at is null or p.active_prod_batch_id is not null then raise exception 'Peça % indisponível ou já emitida.',p.code; end if;
  if p.quantity<>1 then raise exception 'Quantidade múltipla exige conferência específica: %.',p.code; end if;
  if not(p.project_only or p.measurement_not_required) and (coalesce(p.measured_width_mm,0)<=0 or coalesce(p.measured_height_mm,0)<=0) then raise exception 'Medidas de campo ausentes: %.',p.code; end if;
  if exists(select 1 from technical_corrections where company_id=co and contract_id=cid and piece_id=p.id and deleted_at is null and blocking and status not in ('encerrada','cancelada')) then raise exception 'Correção bloqueante: %.',p.code; end if;
  if technical_alignment_has_block(co,cid,'prods',p.id) then raise exception 'Pendência bloqueante: %.',p.code; end if;
  select tr.* into r from technical_release_pieces l join technical_releases tr on tr.id=l.release_id where l.piece_id=p.id and tr.company_id=co and tr.contract_id=cid order by l.created_at desc,l.id limit 1;
  if not found or r.status='cancelado' or (r.validation_required and r.status<>'validado' and (not exists(select 1 from technical_release_participants where release_id=r.id) or exists(select 1 from technical_release_participants where release_id=r.id and signed_at is null))) then raise exception 'Confira o lote da peça %.',p.code; end if;
 end loop;
 insert into technical_prod_batch_pieces(prod_batch_id,piece_id) select b.id,unnest(ids) on conflict(prod_batch_id,piece_id) do nothing;
 update technical_contract_pieces set active_prod_batch_id=b.id,status='em_prod',cem_registered=true,cem_checked=true where id=any(ids);
 update technical_fabrication_sets set workflow_ready=true where id=sid;
 update technical_prod_batches set status='aguardando_conferencia',cem_registered=true,cem_checked=true where id=b.id;
 insert into audit_logs(company_id,entity,entity_id,action,user_id,after_data,notes) values(co,'technical_prod_batches',b.id,'fabrication_set_ready',actor,jsonb_build_object('setId',sid,'sourcePieces',ids,'manufacturingItems',(select jsonb_agg(to_jsonb(i)) from technical_fabrication_items i where import_id=imp.id)),'Conjunto completo encaminhado para conferência. Saldo vinculado uma única vez; medidas de campo e serviços terceirizados preservados.');
 return b.id;
end $$;
revoke all on function public.technical_prepare_fabrication_prod(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.technical_prepare_fabrication_prod(uuid,uuid,uuid,uuid) to service_role;
create or replace function public.technical_guard_fabrication_preview() returns trigger language plpgsql set search_path=public as $$
declare s technical_fabrication_sets%rowtype; imp technical_fabrication_imports%rowtype; ids uuid[];
begin
 if not(new.cem_report ? 'fabricationSetId') then return new; end if;
 if new.status='rascunho' then return new; end if;
 select * into s from technical_fabrication_sets where id=(new.cem_report->>'fabricationSetId')::uuid and company_id=new.company_id and contract_id=new.contract_id;
 if not found or not s.workflow_ready then raise exception 'Conjunto ainda não encaminhado para conferência.'; end if;
 if new.status='cancelado' then raise exception 'Cancelamento de conjunto exige revisão dos vínculos e saldos.'; end if;
 select * into strict imp from technical_fabrication_imports where set_id=s.id and prod_batch_id=new.id;
 select array_agg(distinct piece_id) into ids from (select piece_id from technical_fabrication_set_sources where set_id=s.id union select piece_id from technical_fabrication_items where import_id=imp.id and piece_id is not null) q;
 if (select count(*) from technical_prod_batch_pieces where prod_batch_id=new.id)<>cardinality(ids) or exists(select 1 from technical_contract_pieces where id=any(ids) and (active_prod_batch_id is distinct from new.id or status not in ('em_prod','entregue'))) then raise exception 'Saldo ou vínculo divergente do conjunto.'; end if;
 if tg_op='UPDATE' and new.status<>old.status then
  if not((old.status='rascunho' and new.status='aguardando_conferencia') or (old.status='aguardando_conferencia' and new.status='aguardando_aprovacao') or (old.status='aguardando_aprovacao' and new.status='aprovado')) then raise exception 'Transição inválida para o conjunto.'; end if;
 end if;
 if new.status in ('aguardando_aprovacao','aprovado') and (not new.cem_registered or not new.cem_checked or new.checked_at is null or new.checked_by_profile_id is null) then raise exception 'Conferência técnica obrigatória.'; end if;
 if new.status='aprovado' and (tg_op='INSERT' or old.status is distinct from 'aprovado') then
  if new.approved_by_profile_id is null or new.approved_at is null then raise exception 'Aprovação sem responsável ou data.'; end if;
  new.approved_snapshot:=coalesce(new.approved_snapshot,'{}'::jsonb)||jsonb_build_object('fabricationSet',to_jsonb(s),'fabricationItems',(select jsonb_agg(to_jsonb(i)) from technical_fabrication_items i where import_id=imp.id),'externalServices',(select jsonb_agg(to_jsonb(e)) from technical_piece_external_services e where company_id=new.company_id and contract_id=new.contract_id),'scopeConfirmation',(select after_data from audit_logs where entity_id=s.id and action='fabrication_scope_confirmed' order by created_at desc limit 1));
 end if;
 return new;
end $$;
commit;