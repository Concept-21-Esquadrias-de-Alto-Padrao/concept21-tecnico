create table if not exists public.access_review_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  email_confirmed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewer_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists access_review_requests_company_status_idx
  on public.access_review_requests(company_id, status, requested_at desc);

create index if not exists access_review_requests_auth_user_idx
  on public.access_review_requests(auth_user_id);

drop trigger if exists access_review_requests_set_updated_at on public.access_review_requests;
create trigger access_review_requests_set_updated_at
before update on public.access_review_requests
for each row execute function public.touch_updated_at();

alter table public.access_review_requests enable row level security;

create or replace function public.current_auth_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and coalesce(u.email_confirmed_at, u.confirmed_at) is not null
  )
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_company_id uuid;
  profile_name text;
  profile_email text;
begin
  select id
    into target_company_id
  from public.companies
  order by created_at
  limit 1;

  if target_company_id is null then
    insert into public.companies (name)
    values ('Concept21 Aluminium')
    returning id into target_company_id;
  end if;

  profile_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '');
  profile_email := coalesce(new.email, new.id::text || '@auth.local');

  insert into public.profiles (
    company_id,
    user_id,
    name,
    email,
    title,
    status,
    is_master
  )
  values (
    target_company_id,
    new.id,
    coalesce(profile_name, split_part(profile_email, '@', 1), 'Usuario'),
    lower(profile_email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'title', '')), ''),
    'active',
    false
  )
  on conflict (company_id, email) do update
  set
    user_id = coalesce(public.profiles.user_id, excluded.user_id),
    name = coalesce(nullif(excluded.name, ''), public.profiles.name),
    title = coalesce(excluded.title, public.profiles.title),
    status = 'active',
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.request_access_review()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_profile record;
  confirmed_at timestamptz;
  request_id uuid;
begin
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
end;
$$;

create or replace function public.mark_access_request_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.access_review_requests
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where profile_id = new.profile_id
    and status = 'pending';

  update public.platform_notifications
  set read_at = now()
  where entity = 'access_review_request'
    and entity_id in (
      select id
      from public.access_review_requests
      where profile_id = new.profile_id
    )
    and read_at is null;

  return new;
end;
$$;

drop trigger if exists mark_access_request_approved_on_user_roles on public.user_roles;
create trigger mark_access_request_approved_on_user_roles
after insert on public.user_roles
for each row execute function public.mark_access_request_approved();

drop policy if exists access_review_requests_select on public.access_review_requests;
create policy access_review_requests_select on public.access_review_requests
for select to authenticated
using (
  auth_user_id = auth.uid()
  or (
    company_id = public.current_company_id()
    and (public.is_master() or public.has_permission('technical.permissions.manage'))
  )
);

drop policy if exists access_review_requests_update on public.access_review_requests;
create policy access_review_requests_update on public.access_review_requests
for update to authenticated
using (
  company_id = public.current_company_id()
  and (public.is_master() or public.has_permission('technical.permissions.manage'))
)
with check (
  company_id = public.current_company_id()
  and (public.is_master() or public.has_permission('technical.permissions.manage'))
);

