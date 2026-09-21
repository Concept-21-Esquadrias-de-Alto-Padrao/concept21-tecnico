insert into public.permissions (key, description)
values
  ('technical.pieces.change_request', 'Solicitar edição ou exclusão de peças'),
  ('technical.pieces.authorize_change', 'Autorizar edição ou exclusão de peças')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (company_id, role_id, permission_id)
select role.company_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.key = 'technical.pieces.change_request'
where exists (
  select 1
  from public.role_permissions grant_row
  join public.permissions granted_permission on granted_permission.id = grant_row.permission_id
  where grant_row.company_id = role.company_id
    and grant_row.role_id = role.id
    and granted_permission.key in ('technical.measurements.manage', 'technical.pieces.release', 'technical.pieces.edit_released')
)
on conflict (company_id, role_id, permission_id) do nothing;

insert into public.role_permissions (company_id, role_id, permission_id)
select role.company_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.key = 'technical.pieces.authorize_change'
where role.name = 'Gestor Técnico'
   or role.is_master_role
   or exists (
    select 1
    from public.role_permissions grant_row
    join public.permissions granted_permission on granted_permission.id = grant_row.permission_id
    where grant_row.company_id = role.company_id
      and grant_row.role_id = role.id
      and granted_permission.key in ('technical.permissions.manage', 'technical.pieces.edit_released')
  )
on conflict (company_id, role_id, permission_id) do nothing;

create table if not exists public.technical_piece_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  piece_id uuid not null references public.technical_contract_pieces(id) on delete cascade,
  request_type text not null check (request_type in ('edit', 'delete')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'cancelada')),
  reason text not null,
  requested_changes jsonb,
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists technical_piece_change_requests_pending_idx
  on public.technical_piece_change_requests(piece_id)
  where status = 'pendente';

create index if not exists technical_piece_change_requests_contract_idx
  on public.technical_piece_change_requests(company_id, contract_id, status, created_at desc);

drop trigger if exists technical_piece_change_requests_touch_updated_at
on public.technical_piece_change_requests;

create trigger technical_piece_change_requests_touch_updated_at
before update on public.technical_piece_change_requests
for each row execute function public.touch_updated_at();

drop trigger if exists technical_piece_change_requests_audit
on public.technical_piece_change_requests;

create trigger technical_piece_change_requests_audit
after insert or update or delete on public.technical_piece_change_requests
for each row execute function public.audit_table_changes();

alter table public.technical_piece_change_requests enable row level security;

drop policy if exists technical_piece_change_requests_read on public.technical_piece_change_requests;
create policy technical_piece_change_requests_read on public.technical_piece_change_requests
for select to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.has_permission('technical.contracts.view')
    or public.has_permission('technical.pieces.authorize_change')
    or requested_by_profile_id = public.current_profile_id()
  )
);

drop policy if exists technical_piece_change_requests_insert on public.technical_piece_change_requests;
create policy technical_piece_change_requests_insert on public.technical_piece_change_requests
for insert to authenticated
with check (
  company_id = public.current_company_id()
  and public.has_permission('technical.pieces.change_request')
  and requested_by_profile_id = public.current_profile_id()
);

drop policy if exists technical_piece_change_requests_update on public.technical_piece_change_requests;
create policy technical_piece_change_requests_update on public.technical_piece_change_requests
for update to authenticated
using (
  company_id = public.current_company_id()
  and public.has_permission('technical.pieces.authorize_change')
)
with check (
  company_id = public.current_company_id()
  and public.has_permission('technical.pieces.authorize_change')
);
