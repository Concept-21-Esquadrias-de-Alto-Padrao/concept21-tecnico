-- Require the live server authorization without changing native roles or business rows.
set local lock_timeout='5s';
CREATE OR REPLACE FUNCTION corporate_gate_private.is_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select platform_identity_private.request_allowed() and (
select (select auth.uid()) is not null and coalesce(
    (select s.allowed and (
       not exists (select 1 from auth.identities i where i.user_id = s.auth_user_id and i.provider = 'custom:concept21')
       or ((select count(distinct i.provider_id) from auth.identities i
              where i.user_id = s.auth_user_id and i.provider = 'custom:concept21') = 1
           and exists (select 1 from auth.identities i where i.user_id = s.auth_user_id
             and i.provider = 'custom:concept21' and i.provider_id = s.rh_subject::text))
     ) from public.corporate_gate_subjects s where s.auth_user_id = (select auth.uid())),
    not exists (select 1 from auth.identities i where i.user_id = (select auth.uid()) and i.provider = 'custom:concept21')
  )
)
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select platform_identity_private.request_allowed() and (
select public.is_master()
    or exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id and ur.active
      join public.roles r on r.id = ur.role_id and r.active
      join public.role_permissions rp on rp.role_id = r.id and rp.company_id = p.company_id
      join public.permissions perm on perm.id = rp.permission_id
      where p.user_id = auth.uid()
    and corporate_gate_private.is_allowed()
        and p.status = 'active'
        and p.company_id = ur.company_id
        and perm.key = permission_key
    )
)
$function$;

CREATE OR REPLACE FUNCTION public.is_master()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select platform_identity_private.request_allowed() and (
select coalesce(
    (
      select p.is_master
      from public.profiles p
      where p.user_id = auth.uid()
    and corporate_gate_private.is_allowed()
        and p.status = 'active'
      limit 1
    ),
    false
  )
)
$function$;

CREATE OR REPLACE FUNCTION public.has_any_permission(permission_keys text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select platform_identity_private.request_allowed() and (
select public.is_master()
    or exists (
      select 1
      from unnest(permission_keys) permission_key
      where public.has_permission(permission_key)
    )
)
$function$;

CREATE OR REPLACE FUNCTION public.technical_renew_pending_confirmations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inserted_count integer;
begin
 if not platform_identity_private.request_allowed() then raise exception 'Confirme seu primeiro acesso no Portal Concept21.' using errcode='42501';end if;
  insert into public.platform_notifications (
    company_id,
    title,
    body,
    category,
    entity,
    entity_id,
    action_url,
    metadata
  )
  select
    delivery.company_id,
    'Confirmação de entrega pendente',
    'Documento entregue aguarda confirmação do departamento há mais de 24 horas.',
    'technical_delivery_confirmation',
    'technical_department_delivery',
    delivery.id,
    '/tecnico/prods',
    jsonb_build_object(
      'department', delivery.department,
      'delivery_type', delivery.delivery_type,
      'renewed_at', now()
    )
  from public.technical_department_deliveries delivery
  where delivery.status = 'entregue'
    and delivery.confirmation_due_at <= now()
    and (
      delivery.last_notification_at is null
      or delivery.last_notification_at <= now() - interval '24 hours'
    );

  get diagnostics inserted_count = row_count;

  update public.technical_department_deliveries delivery
  set last_notification_at = now()
  where delivery.status = 'entregue'
    and delivery.confirmation_due_at <= now()
    and (
      delivery.last_notification_at is null
      or delivery.last_notification_at <= now() - interval '24 hours'
    );

  return inserted_count;
end
$function$;

CREATE OR REPLACE FUNCTION public.current_auth_email_confirmed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
select platform_identity_private.request_allowed() and (
select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
    and corporate_gate_private.is_allowed()
      and coalesce(u.email_confirmed_at, u.confirmed_at) is not null
  )
)
$function$;

CREATE OR REPLACE FUNCTION public.request_access_review()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  current_profile record;
  confirmed_at timestamptz;
  request_id uuid;
begin
 if not platform_identity_private.request_allowed() then raise exception 'Confirme seu primeiro acesso no Portal Concept21.' using errcode='42501';end if;
  select
    p.id,
    p.company_id,
    p.user_id,
    p.name,
    p.email,
    p.status,
    coalesce(u.email_confirmed_at, u.confirmed_at) as confirmed_at
  into current_profile
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.user_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'Perfil de acesso nao encontrado.';
  end if;

  if current_profile.status <> 'active' then
    raise exception 'Cadastro inativo.';
  end if;

  confirmed_at := current_profile.confirmed_at;

  if confirmed_at is null then
    raise exception 'Confirme seu e-mail antes de solicitar acesso.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = current_profile.id
      and ur.active = true
      and r.active = true
  ) then
    insert into public.access_review_requests (
      company_id,
      profile_id,
      auth_user_id,
      email,
      name,
      status,
      email_confirmed_at,
      reviewed_at,
      reviewed_by
    )
    values (
      current_profile.company_id,
      current_profile.id,
      current_profile.user_id,
      current_profile.email,
      current_profile.name,
      'approved',
      confirmed_at,
      now(),
      auth.uid()
    )
    on conflict (profile_id) do update
    set
      status = 'approved',
      email = excluded.email,
      name = excluded.name,
      email_confirmed_at = excluded.email_confirmed_at,
      reviewed_at = coalesce(public.access_review_requests.reviewed_at, now()),
      reviewed_by = coalesce(public.access_review_requests.reviewed_by, auth.uid()),
      updated_at = now()
    returning id into request_id;

    return request_id;
  end if;

  insert into public.access_review_requests (
    company_id,
    profile_id,
    auth_user_id,
    email,
    name,
    status,
    requested_at,
    email_confirmed_at,
    metadata
  )
  values (
    current_profile.company_id,
    current_profile.id,
    current_profile.user_id,
    current_profile.email,
    current_profile.name,
    'pending',
    now(),
    confirmed_at,
    jsonb_build_object('module', 'technical')
  )
  on conflict (profile_id) do update
  set
    status = 'pending',
    email = excluded.email,
    name = excluded.name,
    requested_at = coalesce(public.access_review_requests.requested_at, now()),
    email_confirmed_at = excluded.email_confirmed_at,
    metadata = public.access_review_requests.metadata || excluded.metadata,
    updated_at = now()
  returning id into request_id;

  if not exists (
    select 1
    from public.platform_notifications notification
    where notification.company_id = current_profile.company_id
      and notification.entity = 'access_review_request'
      and notification.entity_id = request_id
      and notification.read_at is null
  ) then
    insert into public.platform_notifications (
      company_id,
      title,
      body,
      category,
      entity,
      entity_id,
      action_url,
      metadata
    )
    values (
      current_profile.company_id,
      'Cadastro aguardando liberacao',
      current_profile.name || ' confirmou o e-mail e aguarda vinculo de perfil no modulo Tecnico.',
      'security',
      'access_review_request',
      request_id,
      '/tecnico/configuracoes',
      jsonb_build_object('profile_id', current_profile.id, 'email', current_profile.email)
    );
  end if;

  return request_id;
end
$function$;

CREATE OR REPLACE FUNCTION public.technical_stage_validation_satisfied(target_contract_id uuid, target_stage text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  validation_record public.technical_stage_validations%rowtype;
begin
 if not platform_identity_private.request_allowed() then raise exception 'Confirme seu primeiro acesso no Portal Concept21.' using errcode='42501';end if;
  select *
    into validation_record
  from public.technical_stage_validations
  where contract_id = target_contract_id
    and stage = target_stage
  limit 1;

  if validation_record.id is null or not validation_record.validation_required then
    return true;
  end if;

  if not exists (
    select 1
    from public.technical_stage_validation_participants participant
    where participant.validation_id = validation_record.id
  ) then
    return false;
  end if;

  return not exists (
    select 1
    from public.technical_stage_validation_participants participant
    where participant.validation_id = validation_record.id
      and participant.signed_at is null
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.technical_save_alignment(p_company uuid, p_contract uuid, p_profile uuid, p_user uuid, p_version integer, p_finish boolean, p_draft jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 t public.technical_contracts%rowtype; old_state jsonb; next_state jsonb; task jsonb; pid text;
 meeting_uuid uuid; action_uuid uuid; owner_uuid uuid; piece_count integer; piece_labels text; new_version integer;
begin
 if not platform_identity_private.request_allowed() then raise exception 'Confirme seu primeiro acesso no Portal Concept21.' using errcode='42501';end if;
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
end
$function$;

CREATE OR REPLACE FUNCTION public.technical_validate_visit_ready(target_contract_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  technical_record public.technical_contracts%rowtype;
begin
 if not platform_identity_private.request_allowed() then raise exception 'Confirme seu primeiro acesso no Portal Concept21.' using errcode='42501';end if;
  select * into technical_record
  from public.technical_contracts
  where contract_id = target_contract_id;

  if technical_record.contract_id is null then
    raise exception 'Contrato técnico não encontrado.';
  end if;

  if not exists (
    select 1 from public.technical_closing_meetings meeting
    where meeting.company_id = technical_record.company_id
      and meeting.contract_id = target_contract_id
      and meeting.status = 'concluida'
  ) then
    raise exception 'Registre a reunião de fechamento antes de agendar a visita.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'reuniao_ata') then
    raise exception 'Reunião e ata aguardam ciência de todos os participantes.';
  end if;

  if not technical_record.commercial_folder_received then
    raise exception 'Registre a entrega da pasta comercial antes de agendar a visita.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'entrada_comercial') then
    raise exception 'Entrada comercial aguarda ciência de todos os participantes.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'acoes') then
    raise exception 'Ações da etapa inicial aguardam ciência de todos os participantes.';
  end if;

  if exists (
    select 1 from public.technical_actions action
    where action.company_id = technical_record.company_id
      and action.contract_id = target_contract_id
      and action.blocking
      and coalesce(action.blocking_stage, 'entrada_inicial') = 'entrada_inicial'
      and action.status not in ('concluida', 'cancelada')
      and action.deleted_at is null
  ) then
    raise exception 'Ação bloqueante da etapa inicial impede a visita.';
  end if;

  return true;
end
$function$;

CREATE OR REPLACE FUNCTION public.technical_alignment_has_block(p_company uuid, p_contract uuid, p_stage text, p_piece uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select platform_identity_private.request_allowed() and (
select exists(select 1 from technical_actions a where a.company_id=p_company and a.contract_id=p_contract and a.deleted_at is null and a.blocking and a.status not in ('concluida','cancelada') and a.blocking_stage=p_stage and (p_piece is null or (not exists(select 1 from technical_action_pieces l where l.action_id=a.id) and (a.piece_id is null or a.piece_id=p_piece)) or exists(select 1 from technical_action_pieces l where l.action_id=a.id and l.piece_id=p_piece)))
)
$function$;

CREATE OR REPLACE FUNCTION public.current_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select guarded_result.* from (
select p.company_id
  from public.profiles p
  where p.user_id = auth.uid()
    and corporate_gate_private.is_allowed()
    and p.status = 'active'
  limit 1
) guarded_result where (select platform_identity_private.request_allowed())
$function$;

CREATE OR REPLACE FUNCTION public.current_permission_keys()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select guarded_result.* from (
select coalesce(array_agg(distinct perm.key), array[]::text[])
  from public.profiles p
  join public.user_roles ur on ur.profile_id = p.id and ur.active
  join public.roles r on r.id = ur.role_id and r.active
  join public.role_permissions rp on rp.role_id = r.id and rp.company_id = p.company_id
  join public.permissions perm on perm.id = rp.permission_id
  where p.user_id = auth.uid()
    and corporate_gate_private.is_allowed()
    and p.status = 'active'
) guarded_result where (select platform_identity_private.request_allowed())
$function$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select guarded_result.* from (
select p.id
  from public.profiles p
  where p.user_id = auth.uid()
    and corporate_gate_private.is_allowed()
    and p.status = 'active'
  limit 1
) guarded_result where (select platform_identity_private.request_allowed())
$function$;

do $tables$ declare t record;begin
 for t in select schemaname,tablename,rowsecurity from pg_tables where schemaname=any(array['public']) and tablename not in ('platform_identity_config','platform_account_bindings') loop
  if t.rowsecurity then
   execute format('create policy platform_identity_gate on %I.%I as restrictive for all to authenticated using ((select public.platform_identity_can_access())) with check ((select public.platform_identity_can_access()))',t.schemaname,t.tablename);
  end if;
  execute format('create trigger platform_identity_write before insert or update or delete on %I.%I for each statement execute function platform_identity_private.guard_write()',t.schemaname,t.tablename);
 end loop;end$tables$;
notify pgrst,'reload schema';
