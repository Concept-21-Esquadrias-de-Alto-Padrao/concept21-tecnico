create table if not exists public.technical_stage_validations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  stage text not null check (stage in (
    'entrada_comercial',
    'reuniao_ata',
    'acoes',
    'visitas',
    'pecas_medicoes_liberacoes',
    'correcoes',
    'prods',
    'duvidas'
  )),
  validation_required boolean not null default false,
  configured_by_profile_id uuid references public.profiles(id) on delete set null,
  configured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, contract_id, stage)
);

create table if not exists public.technical_stage_validation_participants (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null references public.technical_stage_validations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  stage text not null check (stage in (
    'entrada_comercial',
    'reuniao_ata',
    'acoes',
    'visitas',
    'pecas_medicoes_liberacoes',
    'correcoes',
    'prods',
    'duvidas'
  )),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  signed_at timestamptz,
  signed_by_auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, contract_id, stage, profile_id)
);

create index if not exists technical_stage_validations_contract_idx
  on public.technical_stage_validations(company_id, contract_id, stage);

create index if not exists technical_stage_participants_contract_idx
  on public.technical_stage_validation_participants(company_id, contract_id, stage, signed_at);

create index if not exists technical_stage_participants_profile_idx
  on public.technical_stage_validation_participants(company_id, profile_id, signed_at);

drop trigger if exists technical_stage_validations_touch_updated_at on public.technical_stage_validations;
create trigger technical_stage_validations_touch_updated_at
before update on public.technical_stage_validations
for each row execute function public.touch_updated_at();

drop trigger if exists technical_stage_validation_participants_touch_updated_at on public.technical_stage_validation_participants;
create trigger technical_stage_validation_participants_touch_updated_at
before update on public.technical_stage_validation_participants
for each row execute function public.touch_updated_at();

drop trigger if exists technical_stage_validations_audit on public.technical_stage_validations;
create trigger technical_stage_validations_audit
after insert or update or delete on public.technical_stage_validations
for each row execute function public.audit_table_changes();

drop trigger if exists technical_stage_validation_participants_audit on public.technical_stage_validation_participants;
create trigger technical_stage_validation_participants_audit
after insert or update or delete on public.technical_stage_validation_participants
for each row execute function public.audit_table_changes();

alter table public.technical_stage_validations enable row level security;
alter table public.technical_stage_validation_participants enable row level security;

drop policy if exists technical_stage_validations_read on public.technical_stage_validations;
create policy technical_stage_validations_read on public.technical_stage_validations
for select to authenticated
using (
  company_id = public.current_company_id()
  and public.has_any_permission(array['technical.contracts.view', 'technical.dashboard.view', 'technical.prods.view'])
);

drop policy if exists technical_stage_validations_insert on public.technical_stage_validations;
create policy technical_stage_validations_insert on public.technical_stage_validations
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.contracts.edit'));

drop policy if exists technical_stage_validations_update on public.technical_stage_validations;
create policy technical_stage_validations_update on public.technical_stage_validations
for update to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.contracts.edit'))
with check (company_id = public.current_company_id());

drop policy if exists technical_stage_validations_delete on public.technical_stage_validations;
create policy technical_stage_validations_delete on public.technical_stage_validations
for delete to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.contracts.edit'));

drop policy if exists technical_stage_participants_read on public.technical_stage_validation_participants;
create policy technical_stage_participants_read on public.technical_stage_validation_participants
for select to authenticated
using (
  company_id = public.current_company_id()
  and (
    profile_id = public.current_profile_id()
    or public.has_any_permission(array['technical.contracts.view', 'technical.dashboard.view', 'technical.prods.view'])
  )
);

drop policy if exists technical_stage_participants_insert on public.technical_stage_validation_participants;
create policy technical_stage_participants_insert on public.technical_stage_validation_participants
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.contracts.edit'));

drop policy if exists technical_stage_participants_update on public.technical_stage_validation_participants;
create policy technical_stage_participants_update on public.technical_stage_validation_participants
for update to authenticated
using (
  company_id = public.current_company_id()
  and (
    profile_id = public.current_profile_id()
    or public.has_permission('technical.contracts.edit')
  )
)
with check (company_id = public.current_company_id());

drop policy if exists technical_stage_participants_delete on public.technical_stage_validation_participants;
create policy technical_stage_participants_delete on public.technical_stage_validation_participants
for delete to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.contracts.edit'));

create or replace function public.technical_stage_validation_satisfied(
  target_contract_id uuid,
  target_stage text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  validation_record public.technical_stage_validations%rowtype;
begin
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
end;
$$;

create or replace function public.technical_validate_visit_ready(target_contract_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  technical_record public.technical_contracts%rowtype;
begin
  select *
    into technical_record
  from public.technical_contracts
  where contract_id = target_contract_id;

  if technical_record.contract_id is null then
    raise exception 'Contrato técnico não encontrado.';
  end if;

  if not technical_record.commercial_folder_received then
    raise exception 'Contrato sem pasta comercial entregue não avança para visita inicial.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'entrada_comercial') then
    raise exception 'Entrada comercial aguarda ciência de todos os participantes.';
  end if;

  if not exists (
    select 1
    from public.technical_closing_meetings meeting
    where meeting.contract_id = target_contract_id
      and meeting.status = 'concluida'
  ) then
    raise exception 'Contrato sem reunião de fechamento não avança para visita inicial.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'reuniao_ata') then
    raise exception 'Reunião e ata aguardam ciência de todos os participantes.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'acoes') then
    raise exception 'Ações da etapa inicial aguardam ciência de todos os participantes.';
  end if;

  if exists (
    select 1
    from public.technical_actions action
    where action.contract_id = target_contract_id
      and action.blocking
      and coalesce(action.blocking_stage, 'entrada_inicial') = 'entrada_inicial'
      and action.status not in ('concluida', 'validada', 'cancelada')
      and action.deleted_at is null
  ) then
    raise exception 'Ação bloqueante da etapa inicial impede a visita.';
  end if;

  return true;
end;
$$;
