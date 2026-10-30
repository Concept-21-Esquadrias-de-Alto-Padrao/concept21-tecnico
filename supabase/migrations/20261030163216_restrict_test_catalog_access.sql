-- F07: restrict four public tables in the Technical TEST environment.
-- The application reads/writes these tables through its server-side service
-- client; signup's auth.users trigger is SECURITY DEFINER. No data is changed.
begin;

alter table public.companies enable row level security;
alter table public.departments enable row level security;
alter table public.roles enable row level security;
alter table public.email_notification_queue enable row level security;

revoke all privileges on table
  public.companies,
  public.departments,
  public.roles,
  public.email_notification_queue
from public, anon;

-- Existing signed-in users retain same-company catalog reads. Mutations remain
-- on the server, where explicit authorization is checked before service access.
create policy companies_same_company_read on public.companies
for select to authenticated
using (id = (select public.current_company_id()));

create policy departments_same_company_read on public.departments
for select to authenticated
using (company_id = (select public.current_company_id()));

create policy roles_same_company_read on public.roles
for select to authenticated
using (company_id = (select public.current_company_id()));

-- The email queue has no direct client policy. Only trusted server routines and
-- the service role may access it.
commit;
