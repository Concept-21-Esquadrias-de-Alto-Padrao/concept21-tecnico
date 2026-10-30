-- Run only after restrict_test_catalog_access.sql in Técnico TESTE.
-- The first query must return four rows with rls_enabled=true, anon read/write
-- false, service read/write true. The email queue must have zero policies.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_read,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_write,
       has_table_privilege('service_role', c.oid, 'SELECT') as service_read,
       has_table_privilege('service_role', c.oid, 'INSERT') as service_write,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('companies', 'departments', 'roles', 'email_notification_queue')
order by c.relname;

-- Use one active TESTE profile to verify signed-in, same-company reads.
-- This transaction changes no rows and does not leave a session switched.
begin read only;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.profiles
   where status = 'active' and user_id is not null
   order by created_at limit 1),
  true
);
set local role authenticated;
select public.current_company_id() is not null as linked_profile,
       (select count(*) from public.companies) as visible_companies,
       (select count(*) from public.roles) as visible_roles,
       (select count(*) from public.email_notification_queue) as visible_queue_rows;
rollback;

-- A real API check must still confirm that an anonymous SELECT/INSERT is
-- rejected and that the application signup/settings flows keep working.
