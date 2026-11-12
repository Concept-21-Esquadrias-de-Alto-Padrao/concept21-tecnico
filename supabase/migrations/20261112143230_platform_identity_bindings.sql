create table public.platform_account_bindings (
 auth_user_id uuid primary key references auth.users(id),
 portal_auth_user_id uuid not null unique,
 portal_link_id uuid not null unique,
 allowed boolean not null default true,
 updated_at timestamptz not null default now()
);
create table public.platform_identity_config (
 key text primary key check (key='central_login'),
 enabled boolean not null default false
);
alter table public.platform_account_bindings enable row level security;
alter table public.platform_identity_config enable row level security;
revoke all on public.platform_account_bindings, public.platform_identity_config from public, anon, authenticated;
grant all on public.platform_account_bindings, public.platform_identity_config to service_role;
insert into public.platform_identity_config(key,enabled) values ('central_login',false);
