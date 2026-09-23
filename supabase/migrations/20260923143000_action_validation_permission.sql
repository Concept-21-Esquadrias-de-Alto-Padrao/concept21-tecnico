insert into public.permissions (key, description)
values
  ('technical.actions.validate', 'Validar ações técnicas')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (company_id, role_id, permission_id)
select grant_row.company_id, grant_row.role_id, validate_permission.id
from public.role_permissions grant_row
join public.permissions reopen_permission on reopen_permission.id = grant_row.permission_id
join public.permissions validate_permission on validate_permission.key = 'technical.actions.validate'
where reopen_permission.key = 'technical.actions.reopen'
  and not exists (
    select 1
    from public.role_permissions existing
    where existing.company_id = grant_row.company_id
      and existing.role_id = grant_row.role_id
      and existing.permission_id = validate_permission.id
  )
on conflict do nothing;

insert into public.role_permissions (company_id, role_id, permission_id)
select role.company_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.key = 'technical.actions.validate'
where role.name = 'Gestor Técnico'
  and not exists (
    select 1
    from public.role_permissions existing
    where existing.company_id = role.company_id
      and existing.role_id = role.id
      and existing.permission_id = permission.id
  )
on conflict do nothing;
