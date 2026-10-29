-- Restrict the reminder renewal RPC to signed-in users and service jobs.
-- The function body is unchanged; revoke the default PUBLIC/anon grant.
begin;

revoke all on function public.technical_renew_pending_confirmations()
  from public, anon;
grant execute on function public.technical_renew_pending_confirmations()
  to authenticated, service_role;

commit;
