insert into public.permissions (key, description)
values ('technical.contracts.correct_work_data', 'Corrigir dados da obra do contrato')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (company_id, role_id, permission_id)
select role.company_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.key = 'technical.contracts.correct_work_data'
where role.name = 'Gestor Técnico'
  and role.active = true
on conflict (company_id, role_id, permission_id) do nothing;
