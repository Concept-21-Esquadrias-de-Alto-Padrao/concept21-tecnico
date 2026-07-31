create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid,
  name text not null,
  email text not null,
  title text,
  department_id uuid references public.departments(id) on delete set null,
  status text not null default 'active',
  avatar_url text,
  is_master boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, email)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  is_master_role boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(company_id, role_id, permission_id)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, profile_id, role_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  trade_name text,
  document text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_number text not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  work_name text not null,
  full_address text not null,
  street text,
  block text,
  lot text,
  sector text,
  city text not null default 'Goiânia',
  state text not null default 'GO',
  zip_code text,
  site_contact text,
  site_contact_phone text,
  general_delivery_forecast date,
  notes text,
  status text not null default 'ativo',
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, contract_number)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  user_id uuid,
  before_data jsonb,
  after_data jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  recipient_auth_user_id uuid,
  title text not null,
  body text not null,
  category text not null,
  entity text,
  entity_id uuid,
  action_url text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_notification_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.status = 'active'
  limit 1
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.status = 'active'
  limit 1
$$;

create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_master
      from public.profiles p
      where p.user_id = auth.uid()
        and p.status = 'active'
      limit 1
    ),
    false
  )
$$;

create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_master()
    or exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id and ur.active
      join public.roles r on r.id = ur.role_id and r.active
      join public.role_permissions rp on rp.role_id = r.id and rp.company_id = p.company_id
      join public.permissions perm on perm.id = rp.permission_id
      where p.user_id = auth.uid()
        and p.status = 'active'
        and p.company_id = ur.company_id
        and perm.key = permission_key
    )
$$;

create or replace function public.has_any_permission(permission_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_master()
    or exists (
      select 1
      from unnest(permission_keys) permission_key
      where public.has_permission(permission_key)
    )
$$;

create or replace function public.current_permission_keys()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct perm.key), array[]::text[])
  from public.profiles p
  join public.user_roles ur on ur.profile_id = p.id and ur.active
  join public.roles r on r.id = ur.role_id and r.active
  join public.role_permissions rp on rp.role_id = r.id and rp.company_id = p.company_id
  join public.permissions perm on perm.id = rp.permission_id
  where p.user_id = auth.uid()
    and p.status = 'active'
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.audit_table_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_company_id uuid;
  row_id uuid;
  before_data jsonb;
  after_data jsonb;
  row_data jsonb;
begin
  before_data := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_data := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_data := coalesce(after_data, before_data);
  row_company_id := nullif(row_data ->> 'company_id', '')::uuid;
  row_id := coalesce(nullif(row_data ->> 'id', ''), nullif(row_data ->> 'contract_id', ''))::uuid;

  insert into public.audit_logs (
    company_id,
    entity,
    entity_id,
    action,
    user_id,
    before_data,
    after_data
  )
  values (
    row_company_id,
    tg_table_name,
    row_id,
    lower(tg_op),
    auth.uid(),
    before_data,
    after_data
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create table if not exists public.technical_contracts (
  contract_id uuid primary key references public.production_contracts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_date date,
  contractual_deadline_value integer,
  contractual_deadline_unit text not null default 'dias_uteis'
    check (contractual_deadline_unit in ('dias_uteis', 'dias_corridos')),
  technical_status text not null default 'aguardando_pasta'
    check (technical_status in (
      'aguardando_pasta',
      'aguardando_reuniao',
      'em_acompanhamento',
      'aguardando_visita',
      'em_medicao',
      'em_liberacao',
      'em_prod',
      'repassado',
      'concluido',
      'cancelado'
    )),
  technical_manager_profile_id uuid references public.profiles(id) on delete set null,
  followup_profile_id uuid references public.profiles(id) on delete set null,
  commercial_folder_received boolean not null default false,
  folder_received_at timestamptz,
  folder_delivered_by text,
  folder_received_by_profile_id uuid references public.profiles(id) on delete set null,
  commercial_data jsonb not null default '{}'::jsonb,
  authorized_contacts jsonb not null default '[]'::jsonb,
  technical_notes text,
  risk_status text not null default 'normal' check (risk_status in ('normal', 'atencao', 'risco', 'atrasado')),
  risk_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_contract_pieces (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  production_piece_id uuid,
  code text not null,
  parent_piece_id uuid references public.technical_contract_pieces(id) on delete set null,
  piece_type text,
  quantity integer not null default 1 check (quantity > 0),
  sale_width_mm numeric,
  sale_height_mm numeric,
  measured_width_mm numeric,
  measured_height_mm numeric,
  environment text,
  floor text,
  description text,
  glass text,
  color text,
  line text,
  status text not null default 'aguardando_avaliacao'
    check (status in (
      'aguardando_avaliacao',
      'avaliada',
      'medida',
      'liberada',
      'em_correcao',
      'em_prod',
      'entregue',
      'cancelada'
    )),
  released_at timestamptz,
  release_visit_id uuid,
  release_due_date date,
  exceptional_due_date date,
  cem_registered boolean not null default false,
  cem_checked boolean not null default false,
  active_prod_batch_id uuid,
  source text not null default 'manual',
  sort_order integer not null default 1,
  notes text,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_closing_meetings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  meeting_date date not null,
  meeting_time time,
  participants text[] not null default '{}',
  summary text,
  decisions text,
  blockers text,
  status text not null default 'rascunho' check (status in ('rascunho', 'concluida', 'cancelada')),
  registered_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  meeting_id uuid references public.technical_closing_meetings(id) on delete set null,
  title text not null,
  description text,
  responsible_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  priority text not null default 'normal' check (priority in ('baixa', 'normal', 'alta', 'urgente')),
  blocking boolean not null default false,
  blocking_stage text,
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'concluida', 'validada', 'cancelada')),
  completed_at timestamptz,
  validated_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_visits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  visit_type text not null,
  scheduled_date date not null,
  scheduled_time time,
  performed_at timestamptz,
  technicians text[] not null default '{}',
  accompanied_by text,
  objectives text[] not null default '{}',
  result_summary text,
  report_required boolean not null default true,
  report_generated_at timestamptz,
  report_sent_at timestamptz,
  report_snapshot jsonb,
  status text not null default 'agendada'
    check (status in ('agendada', 'realizada', 'aguardando_relatorio', 'relatorio_emitido', 'cancelada')),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_visit_pieces (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.technical_visits(id) on delete cascade,
  piece_id uuid not null references public.technical_contract_pieces(id) on delete cascade,
  objective text,
  result text,
  created_at timestamptz not null default now(),
  unique(visit_id, piece_id)
);

create table if not exists public.technical_opening_assessments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  piece_id uuid references public.technical_contract_pieces(id) on delete cascade,
  visit_id uuid references public.technical_visits(id) on delete set null,
  environment text,
  result text not null,
  notes text,
  assessed_by_profile_id uuid references public.profiles(id) on delete set null,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_measurements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  piece_id uuid not null references public.technical_contract_pieces(id) on delete cascade,
  visit_id uuid references public.technical_visits(id) on delete set null,
  measured_width_mm numeric,
  measured_height_mm numeric,
  signed_by text,
  signed_at timestamptz,
  superseded_by_measurement_id uuid references public.technical_measurements(id) on delete set null,
  notes text,
  measured_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_releases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  visit_id uuid references public.technical_visits(id) on delete set null,
  release_date date not null default current_date,
  default_due_date date,
  notes text,
  released_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_release_pieces (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.technical_releases(id) on delete cascade,
  piece_id uuid not null references public.technical_contract_pieces(id) on delete cascade,
  due_date date,
  exception_reason text,
  created_at timestamptz not null default now(),
  unique(release_id, piece_id)
);

create table if not exists public.technical_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  piece_id uuid references public.technical_contract_pieces(id) on delete set null,
  prod_batch_id uuid,
  type text not null,
  description text not null,
  responsible_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  priority text not null default 'normal' check (priority in ('baixa', 'normal', 'alta', 'urgente')),
  blocking boolean not null default false,
  critical boolean not null default false,
  impact text,
  status text not null default 'aberta'
    check (status in ('aberta', 'em_andamento', 'aguardando_validacao', 'encerrada', 'cancelada')),
  closed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_prod_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  batch_number text not null,
  description text,
  status text not null default 'rascunho'
    check (status in (
      'rascunho',
      'aguardando_cem',
      'aguardando_conferencia',
      'aguardando_aprovacao',
      'aprovado',
      'devolvido',
      'entregue_suprimentos',
      'entregue_producao',
      'concluido',
      'cancelado'
    )),
  cem_registered boolean not null default false,
  cem_checked boolean not null default false,
  checked_by_profile_id uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approved_snapshot jsonb,
  correction_round integer not null default 0,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, contract_id, batch_number)
);

alter table public.technical_contract_pieces
  drop constraint if exists technical_contract_pieces_active_prod_batch_fk;
alter table public.technical_contract_pieces
  add constraint technical_contract_pieces_active_prod_batch_fk
  foreign key (active_prod_batch_id) references public.technical_prod_batches(id) on delete set null;

alter table public.technical_corrections
  drop constraint if exists technical_corrections_prod_batch_fk;
alter table public.technical_corrections
  add constraint technical_corrections_prod_batch_fk
  foreign key (prod_batch_id) references public.technical_prod_batches(id) on delete set null;

create table if not exists public.technical_prod_batch_pieces (
  id uuid primary key default gen_random_uuid(),
  prod_batch_id uuid not null references public.technical_prod_batches(id) on delete cascade,
  piece_id uuid not null references public.technical_contract_pieces(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(prod_batch_id, piece_id)
);

create table if not exists public.technical_prod_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  prod_batch_id uuid not null references public.technical_prod_batches(id) on delete cascade,
  document_type text not null check (document_type in ('lista_materiais', 'ordem_producao', 'planilha_resumo')),
  status text not null default 'rascunho' check (status in ('rascunho', 'emitido', 'conferido', 'aprovado', 'entregue', 'corrigido', 'cancelado')),
  generated_at timestamptz,
  sent_at timestamptz,
  structured_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_department_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  prod_batch_id uuid not null references public.technical_prod_batches(id) on delete cascade,
  department text not null check (department in ('suprimentos', 'producao')),
  delivery_type text not null check (delivery_type in ('lista_materiais', 'ordem_producao')),
  delivered_at timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'entregue', 'confirmado', 'recusado', 'devolvido')),
  confirmation_due_at timestamptz,
  last_notification_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_department_confirmations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_id uuid not null references public.technical_department_deliveries(id) on delete cascade,
  confirmed_by_profile_id uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  status text not null default 'confirmado' check (status in ('confirmado', 'recusado', 'devolvido')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.technical_doubt_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  area text not null check (area in ('producao', 'obras_instalacoes')),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, area, name)
);

create table if not exists public.technical_doubts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  area text not null check (area in ('producao', 'obras_instalacoes')),
  contract_id uuid references public.production_contracts(id) on delete set null,
  piece_id uuid references public.technical_contract_pieces(id) on delete set null,
  prod_batch_id uuid references public.technical_prod_batches(id) on delete set null,
  category text,
  question text not null,
  answer text,
  status text not null default 'aberta' check (status in ('aberta', 'respondida', 'encerrada')),
  frequent boolean not null default false,
  asked_by_profile_id uuid references public.profiles(id) on delete set null,
  answered_by_profile_id uuid references public.profiles(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null,
  value jsonb not null,
  description text,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, key)
);

create table if not exists public.technical_holidays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  holiday_date date not null,
  scope text not null default 'nacional' check (scope in ('nacional', 'estadual', 'municipal')),
  name text not null,
  city text,
  state text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_report_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid references public.production_contracts(id) on delete cascade,
  visit_id uuid references public.technical_visits(id) on delete set null,
  prod_batch_id uuid references public.technical_prod_batches(id) on delete set null,
  event_type text not null,
  structured_snapshot jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.technical_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  reason text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada')),
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technical_contracts_company_status_idx on public.technical_contracts(company_id, technical_status);
create index if not exists technical_pieces_contract_status_idx on public.technical_contract_pieces(company_id, contract_id, status);
create unique index if not exists technical_pieces_code_active_idx
  on public.technical_contract_pieces(company_id, contract_id, lower(code))
  where deleted_at is null;
create index if not exists technical_actions_contract_due_idx on public.technical_actions(company_id, contract_id, due_date);
create index if not exists technical_visits_schedule_idx on public.technical_visits(company_id, scheduled_date, status);
create index if not exists technical_corrections_due_idx on public.technical_corrections(company_id, due_date, status);
create index if not exists technical_prod_batches_status_idx on public.technical_prod_batches(company_id, status);
create index if not exists technical_doubts_area_status_idx on public.technical_doubts(company_id, area, status);
create index if not exists technical_deliveries_pending_idx on public.technical_department_deliveries(company_id, status, confirmation_due_at);
create index if not exists technical_audit_entity_idx on public.audit_logs(company_id, entity, entity_id, created_at desc);
create unique index if not exists technical_holidays_unique_idx
  on public.technical_holidays(company_id, holiday_date, scope, coalesce(city, ''), coalesce(state, ''));

create or replace function public.prevent_technical_visit_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Visitas não podem ser excluídas; cancele o registro para preservar o histórico.';
end;
$$;

drop trigger if exists technical_visits_prevent_delete on public.technical_visits;
create trigger technical_visits_prevent_delete
before delete on public.technical_visits
for each row execute function public.prevent_technical_visit_delete();

create or replace function public.technical_validate_department_delivery()
returns trigger
language plpgsql
as $$
begin
  if new.department = 'suprimentos' and new.delivery_type <> 'lista_materiais' then
    raise exception 'Suprimentos confirma somente listas de materiais.';
  end if;

  if new.department = 'producao' and new.delivery_type <> 'ordem_producao' then
    raise exception 'Produção confirma somente ordens de produção.';
  end if;

  return new;
end;
$$;

drop trigger if exists technical_department_delivery_guard on public.technical_department_deliveries;
create trigger technical_department_delivery_guard
before insert or update on public.technical_department_deliveries
for each row execute function public.technical_validate_department_delivery();

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

  if not exists (
    select 1
    from public.technical_closing_meetings meeting
    where meeting.contract_id = target_contract_id
      and meeting.status = 'concluida'
  ) then
    raise exception 'Contrato sem reunião de fechamento não avança para visita inicial.';
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

create or replace function public.technical_renew_pending_confirmations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
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
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'clients',
    'production_contracts',
    'technical_contracts',
    'technical_contract_pieces',
    'technical_closing_meetings',
    'technical_actions',
    'technical_visits',
    'technical_opening_assessments',
    'technical_measurements',
    'technical_releases',
    'technical_corrections',
    'technical_prod_batches',
    'technical_prod_documents',
    'technical_department_deliveries',
    'technical_doubt_categories',
    'technical_doubts',
    'technical_settings',
    'technical_holidays',
    'technical_deletion_requests'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'technical_contracts',
    'technical_contract_pieces',
    'technical_closing_meetings',
    'technical_actions',
    'technical_visits',
    'technical_opening_assessments',
    'technical_measurements',
    'technical_releases',
    'technical_corrections',
    'technical_prod_batches',
    'technical_prod_documents',
    'technical_department_deliveries',
    'technical_doubts',
    'technical_settings',
    'technical_holidays',
    'technical_deletion_requests'
  ] loop
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_table_changes()', table_name, table_name);
  end loop;
end $$;

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.production_contracts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_notifications enable row level security;
alter table public.technical_contracts enable row level security;
alter table public.technical_contract_pieces enable row level security;
alter table public.technical_closing_meetings enable row level security;
alter table public.technical_actions enable row level security;
alter table public.technical_visits enable row level security;
alter table public.technical_visit_pieces enable row level security;
alter table public.technical_opening_assessments enable row level security;
alter table public.technical_measurements enable row level security;
alter table public.technical_releases enable row level security;
alter table public.technical_release_pieces enable row level security;
alter table public.technical_corrections enable row level security;
alter table public.technical_prod_batches enable row level security;
alter table public.technical_prod_batch_pieces enable row level security;
alter table public.technical_prod_documents enable row level security;
alter table public.technical_department_deliveries enable row level security;
alter table public.technical_department_confirmations enable row level security;
alter table public.technical_doubt_categories enable row level security;
alter table public.technical_doubts enable row level security;
alter table public.technical_settings enable row level security;
alter table public.technical_holidays enable row level security;
alter table public.technical_report_events enable row level security;
alter table public.technical_deletion_requests enable row level security;

drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read on public.permissions
for select to authenticated using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
for select to authenticated using (company_id = public.current_company_id() or public.is_master());

drop policy if exists clients_technical_read on public.clients;
create policy clients_technical_read on public.clients
for select to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.view', 'technical.dashboard.view']));

drop policy if exists clients_technical_insert on public.clients;
create policy clients_technical_insert on public.clients
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.manual_create', 'technical.contracts.import_pdf']));

drop policy if exists contracts_technical_read on public.production_contracts;
create policy contracts_technical_read on public.production_contracts
for select to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.view', 'technical.dashboard.view', 'technical.prods.view']));

drop policy if exists contracts_technical_insert on public.production_contracts;
create policy contracts_technical_insert on public.production_contracts
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.manual_create', 'technical.contracts.import_pdf']));

drop policy if exists contracts_technical_update on public.production_contracts;
create policy contracts_technical_update on public.production_contracts
for update to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.contracts.edit'))
with check (company_id = public.current_company_id());

drop policy if exists audit_technical_read on public.audit_logs;
create policy audit_technical_read on public.audit_logs
for select to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.audit.view', 'technical.settings.manage']));

drop policy if exists notifications_own_read on public.platform_notifications;
create policy notifications_own_read on public.platform_notifications
for select to authenticated
using (
  company_id = public.current_company_id()
  and (recipient_profile_id is null or recipient_profile_id = public.current_profile_id() or public.is_master())
);

drop policy if exists notifications_own_update on public.platform_notifications;
create policy notifications_own_update on public.platform_notifications
for update to authenticated
using (
  company_id = public.current_company_id()
  and (recipient_profile_id is null or recipient_profile_id = public.current_profile_id() or public.is_master())
)
with check (company_id = public.current_company_id());

drop policy if exists technical_contracts_read on public.technical_contracts;
create policy technical_contracts_read on public.technical_contracts
for select to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.view', 'technical.dashboard.view', 'technical.prods.view']));

drop policy if exists technical_contracts_insert on public.technical_contracts;
create policy technical_contracts_insert on public.technical_contracts
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.manual_create', 'technical.contracts.import_pdf']));

drop policy if exists technical_contracts_update on public.technical_contracts;
create policy technical_contracts_update on public.technical_contracts
for update to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.edit', 'technical.folder.receive', 'technical.meetings.manage']))
with check (company_id = public.current_company_id());

drop policy if exists technical_pieces_read on public.technical_contract_pieces;
create policy technical_pieces_read on public.technical_contract_pieces
for select to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.view', 'technical.prods.view', 'technical.visits.view']));

drop policy if exists technical_pieces_insert on public.technical_contract_pieces;
create policy technical_pieces_insert on public.technical_contract_pieces
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.manual_create', 'technical.contracts.import_pdf', 'technical.measurements.manage']));

drop policy if exists technical_pieces_update on public.technical_contract_pieces;
create policy technical_pieces_update on public.technical_contract_pieces
for update to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.has_permission('technical.pieces.edit_released')
    or public.has_permission('technical.pieces.release')
    or public.has_permission('technical.measurements.manage')
    or public.has_permission('technical.prods.manage')
  )
)
with check (company_id = public.current_company_id());

drop policy if exists technical_meetings_manage on public.technical_closing_meetings;
create policy technical_meetings_manage on public.technical_closing_meetings
for all to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.meetings.manage', 'technical.contracts.view']))
with check (company_id = public.current_company_id() and public.has_permission('technical.meetings.manage'));

drop policy if exists technical_actions_read on public.technical_actions;
create policy technical_actions_read on public.technical_actions
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.actions.view'));

drop policy if exists technical_actions_manage on public.technical_actions;
create policy technical_actions_manage on public.technical_actions
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.actions.manage'));

drop policy if exists technical_actions_update on public.technical_actions;
create policy technical_actions_update on public.technical_actions
for update to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.actions.manage'))
with check (company_id = public.current_company_id());

drop policy if exists technical_visits_read on public.technical_visits;
create policy technical_visits_read on public.technical_visits
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.visits.view'));

drop policy if exists technical_visits_insert on public.technical_visits;
create policy technical_visits_insert on public.technical_visits
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.visits.manage'));

drop policy if exists technical_visits_update on public.technical_visits;
create policy technical_visits_update on public.technical_visits
for update to authenticated
using (
  company_id = public.current_company_id()
  and public.has_any_permission(array['technical.visits.manage', 'technical.visits.cancel', 'technical.reports.generate'])
)
with check (company_id = public.current_company_id());

drop policy if exists technical_visit_pieces_read on public.technical_visit_pieces;
create policy technical_visit_pieces_read on public.technical_visit_pieces
for select to authenticated
using (
  exists (
    select 1
    from public.technical_visits visit
    where visit.id = visit_id
      and visit.company_id = public.current_company_id()
      and public.has_permission('technical.visits.view')
  )
);

drop policy if exists technical_visit_pieces_manage on public.technical_visit_pieces;
create policy technical_visit_pieces_manage on public.technical_visit_pieces
for insert to authenticated
with check (
  exists (
    select 1
    from public.technical_visits visit
    where visit.id = visit_id
      and visit.company_id = public.current_company_id()
      and public.has_permission('technical.visits.manage')
  )
);

drop policy if exists technical_measurement_tables_read on public.technical_measurements;
create policy technical_measurement_tables_read on public.technical_measurements
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.contracts.view'));

drop policy if exists technical_measurement_tables_manage on public.technical_measurements;
create policy technical_measurement_tables_manage on public.technical_measurements
for all to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.measurements.manage'))
with check (company_id = public.current_company_id() and public.has_permission('technical.measurements.manage'));

drop policy if exists technical_assessments_read on public.technical_opening_assessments;
create policy technical_assessments_read on public.technical_opening_assessments
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.contracts.view'));

drop policy if exists technical_assessments_manage on public.technical_opening_assessments;
create policy technical_assessments_manage on public.technical_opening_assessments
for all to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.measurements.manage'))
with check (company_id = public.current_company_id() and public.has_permission('technical.measurements.manage'));

drop policy if exists technical_releases_manage on public.technical_releases;
create policy technical_releases_manage on public.technical_releases
for all to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.contracts.view', 'technical.pieces.release']))
with check (company_id = public.current_company_id() and public.has_permission('technical.pieces.release'));

drop policy if exists technical_release_pieces_manage on public.technical_release_pieces;
create policy technical_release_pieces_manage on public.technical_release_pieces
for all to authenticated
using (true)
with check (true);

drop policy if exists technical_corrections_read on public.technical_corrections;
create policy technical_corrections_read on public.technical_corrections
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.corrections.view'));

drop policy if exists technical_corrections_manage on public.technical_corrections;
create policy technical_corrections_manage on public.technical_corrections
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.corrections.manage'));

drop policy if exists technical_corrections_update on public.technical_corrections;
create policy technical_corrections_update on public.technical_corrections
for update to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.corrections.manage'))
with check (company_id = public.current_company_id());

drop policy if exists technical_prods_read on public.technical_prod_batches;
create policy technical_prods_read on public.technical_prod_batches
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.prods.view'));

drop policy if exists technical_prods_insert on public.technical_prod_batches;
create policy technical_prods_insert on public.technical_prod_batches
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.prods.manage'));

drop policy if exists technical_prods_update on public.technical_prod_batches;
create policy technical_prods_update on public.technical_prod_batches
for update to authenticated
using (
  company_id = public.current_company_id()
  and public.has_any_permission(array['technical.prods.manage', 'technical.prods.check', 'technical.prods.approve', 'technical.prods.change_approved'])
)
with check (
  company_id = public.current_company_id()
  and (
    status <> 'aprovado'
    or public.has_permission('technical.prods.approve')
    or public.has_permission('technical.prods.change_approved')
  )
);

drop policy if exists technical_prod_batch_pieces_read on public.technical_prod_batch_pieces;
create policy technical_prod_batch_pieces_read on public.technical_prod_batch_pieces
for select to authenticated
using (
  exists (
    select 1
    from public.technical_prod_batches prod
    where prod.id = prod_batch_id
      and prod.company_id = public.current_company_id()
      and public.has_permission('technical.prods.view')
  )
);

drop policy if exists technical_prod_batch_pieces_manage on public.technical_prod_batch_pieces;
create policy technical_prod_batch_pieces_manage on public.technical_prod_batch_pieces
for insert to authenticated
with check (
  exists (
    select 1
    from public.technical_prod_batches prod
    where prod.id = prod_batch_id
      and prod.company_id = public.current_company_id()
      and public.has_permission('technical.prods.manage')
  )
);

drop policy if exists technical_prod_documents_read on public.technical_prod_documents;
create policy technical_prod_documents_read on public.technical_prod_documents
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.prods.view'));

drop policy if exists technical_prod_documents_manage on public.technical_prod_documents;
create policy technical_prod_documents_manage on public.technical_prod_documents
for all to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.prods.manage'))
with check (company_id = public.current_company_id() and public.has_permission('technical.prods.manage'));

drop policy if exists technical_deliveries_read on public.technical_department_deliveries;
create policy technical_deliveries_read on public.technical_department_deliveries
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.prods.view'));

drop policy if exists technical_deliveries_manage on public.technical_department_deliveries;
create policy technical_deliveries_manage on public.technical_department_deliveries
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.prods.manage'));

drop policy if exists technical_deliveries_confirm on public.technical_department_deliveries;
create policy technical_deliveries_confirm on public.technical_department_deliveries
for update to authenticated
using (
  company_id = public.current_company_id()
  and (
    (department = 'suprimentos' and public.has_permission('technical.deliveries.suprimentos_confirm'))
    or (department = 'producao' and public.has_permission('technical.deliveries.producao_confirm'))
    or public.has_permission('technical.prods.manage')
  )
)
with check (company_id = public.current_company_id());

drop policy if exists technical_confirmations_insert on public.technical_department_confirmations;
create policy technical_confirmations_insert on public.technical_department_confirmations
for insert to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.technical_department_deliveries delivery
    where delivery.id = delivery_id
      and delivery.company_id = public.current_company_id()
      and (
        (delivery.department = 'suprimentos' and public.has_permission('technical.deliveries.suprimentos_confirm'))
        or (delivery.department = 'producao' and public.has_permission('technical.deliveries.producao_confirm'))
      )
  )
);

drop policy if exists technical_doubt_categories_read on public.technical_doubt_categories;
create policy technical_doubt_categories_read on public.technical_doubt_categories
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.doubts.view'));

drop policy if exists technical_doubts_read on public.technical_doubts;
create policy technical_doubts_read on public.technical_doubts
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.doubts.view'));

drop policy if exists technical_doubts_manage on public.technical_doubts;
create policy technical_doubts_manage on public.technical_doubts
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.doubts.manage'));

drop policy if exists technical_doubts_update on public.technical_doubts;
create policy technical_doubts_update on public.technical_doubts
for update to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.doubts.manage'))
with check (company_id = public.current_company_id());

drop policy if exists technical_settings_read on public.technical_settings;
create policy technical_settings_read on public.technical_settings
for select to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.settings.manage', 'technical.dashboard.view']));

drop policy if exists technical_settings_manage on public.technical_settings;
create policy technical_settings_manage on public.technical_settings
for all to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.settings.manage'))
with check (company_id = public.current_company_id() and public.has_permission('technical.settings.manage'));

drop policy if exists technical_holidays_read on public.technical_holidays;
create policy technical_holidays_read on public.technical_holidays
for select to authenticated
using (company_id = public.current_company_id() and public.has_any_permission(array['technical.settings.manage', 'technical.contracts.view']));

drop policy if exists technical_holidays_manage on public.technical_holidays;
create policy technical_holidays_manage on public.technical_holidays
for all to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.settings.manage'))
with check (company_id = public.current_company_id() and public.has_permission('technical.settings.manage'));

drop policy if exists technical_report_events_read on public.technical_report_events;
create policy technical_report_events_read on public.technical_report_events
for select to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.reports.view'));

drop policy if exists technical_report_events_insert on public.technical_report_events;
create policy technical_report_events_insert on public.technical_report_events
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.reports.generate'));

drop policy if exists technical_deletion_requests_read on public.technical_deletion_requests;
create policy technical_deletion_requests_read on public.technical_deletion_requests
for select to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.has_permission('technical.permissions.manage')
    or requested_by_profile_id = public.current_profile_id()
  )
);

drop policy if exists technical_deletion_requests_insert on public.technical_deletion_requests;
create policy technical_deletion_requests_insert on public.technical_deletion_requests
for insert to authenticated
with check (company_id = public.current_company_id() and public.has_permission('technical.contracts.delete_request'));

drop policy if exists technical_deletion_requests_update on public.technical_deletion_requests;
create policy technical_deletion_requests_update on public.technical_deletion_requests
for update to authenticated
using (company_id = public.current_company_id() and public.has_permission('technical.permissions.manage'))
with check (company_id = public.current_company_id());
