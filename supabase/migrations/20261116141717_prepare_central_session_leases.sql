-- Preparatory schema only: no business gate changes until server renewal is deployed.
create schema if not exists platform_identity_private;
revoke all on schema platform_identity_private from public,anon,authenticated;
grant usage on schema platform_identity_private to service_role;
create table platform_identity_private.leases(session_id uuid primary key references auth.sessions(id) on delete cascade,auth_user_id uuid not null references auth.users(id),valid_until timestamptz not null);
alter table platform_identity_private.leases enable row level security;
revoke all on platform_identity_private.leases from public,anon,authenticated;
grant all on platform_identity_private.leases to service_role;
create function platform_identity_private.native_session_valid(p_user uuid,p_subject uuid,p_session uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_account_bindings b join auth.users a on a.id=b.auth_user_id
 join auth.sessions s on s.user_id=a.id and s.id=p_session
 where b.auth_user_id=p_user and b.portal_auth_user_id=p_subject and b.allowed
 and a.email_confirmed_at is not null and (a.banned_until is null or a.banned_until<now()) and (s.not_after is null or s.not_after>now())
 and exists(select 1 from public.profiles p where p.user_id=a.id and p.status='active')
 and exists(select 1 from auth.identities i where i.user_id=a.id and i.provider='custom:concept21-portal' and i.provider_id=p_subject::text)
 and (select count(distinct i.provider_id) from auth.identities i where i.user_id=a.id and i.provider='custom:concept21-portal')=1
 and exists(select 1 from auth.mfa_amr_claims am where am.session_id=s.id and am.authentication_method='oauth'))
$$;
create function platform_identity_private.session_allowed() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_identity_config c,public.platform_account_bindings b,platform_identity_private.leases l
 where c.key='central_login' and c.enabled and b.auth_user_id=auth.uid() and l.auth_user_id=b.auth_user_id
 and l.session_id=(auth.jwt()->>'session_id')::uuid and l.valid_until>now() and (auth.jwt()->>'client_id') is null
 and platform_identity_private.native_session_valid(b.auth_user_id,b.portal_auth_user_id,l.session_id))
$$;
create function platform_identity_private.request_allowed() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(auth.jwt()->>'role'='service_role',false)
 or ((auth.jwt()->>'role') is null and session_user in ('postgres','supabase_admin','supabase_auth_admin'))
 or platform_identity_private.session_allowed()
$$;
create function platform_identity_private.lease(p_auth_user_id uuid,p_portal_subject uuid,p_session_id uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$begin
 if not exists(select 1 from public.platform_identity_config where key='central_login' and enabled)
 or not platform_identity_private.native_session_valid(p_auth_user_id,p_portal_subject,p_session_id) then return false;end if;
 insert into platform_identity_private.leases(session_id,auth_user_id,valid_until) values(p_session_id,p_auth_user_id,clock_timestamp()+interval '30 seconds')
 on conflict(session_id) do update set valid_until=excluded.valid_until;return true;end$$;
create function public.platform_identity_lease(p_auth_user_id uuid,p_portal_subject uuid,p_session_id uuid) returns boolean
language sql security invoker set search_path=pg_catalog,public as $$select platform_identity_private.lease(p_auth_user_id,p_portal_subject,p_session_id)$$;
create function public.platform_identity_can_access() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$select platform_identity_private.session_allowed()$$;
create function platform_identity_private.guard_write() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$begin
 if not platform_identity_private.request_allowed() then raise exception 'Confirme seu primeiro acesso no Portal Concept21.' using errcode='42501';end if;return null;end$$;
revoke all on function platform_identity_private.native_session_valid(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function platform_identity_private.native_session_valid(uuid,uuid,uuid) to service_role;
revoke all on function platform_identity_private.session_allowed() from public,anon,authenticated;
grant execute on function platform_identity_private.session_allowed() to service_role;
revoke all on function platform_identity_private.request_allowed() from public,anon,authenticated;
grant execute on function platform_identity_private.request_allowed() to service_role;
revoke all on function platform_identity_private.lease(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function platform_identity_private.lease(uuid,uuid,uuid) to service_role;
revoke all on function platform_identity_private.guard_write() from public,anon,authenticated;
grant execute on function platform_identity_private.guard_write() to service_role;
revoke all on function public.platform_identity_lease(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_identity_lease(uuid,uuid,uuid) to service_role;
revoke all on function public.platform_identity_can_access() from public;
grant execute on function public.platform_identity_can_access() to anon,authenticated,service_role;
notify pgrst,'reload schema';
