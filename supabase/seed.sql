insert into public.companies (name)
values ('Concept21 Aluminium')
on conflict do nothing;

insert into public.system_maintenance (company_id)
select id
from public.companies
on conflict (company_id) do nothing;

insert into public.permissions (key, description)
values
  ('technical.dashboard.view', 'Visualizar painel técnico'),
  ('technical.contracts.view', 'Visualizar contratos técnicos'),
  ('technical.contracts.import_pdf', 'Importar contrato por PDF'),
  ('technical.contracts.manual_create', 'Cadastrar contratos e peças manualmente'),
  ('technical.contracts.edit', 'Editar dados de contrato técnico'),
  ('technical.contracts.delete_request', 'Solicitar exclusão protegida'),
  ('technical.financial.view', 'Visualizar informações financeiras do contrato'),
  ('technical.folder.receive', 'Registrar recebimento da pasta comercial'),
  ('technical.meetings.manage', 'Registrar reunião de fechamento e ata'),
  ('technical.actions.view', 'Visualizar ações técnicas'),
  ('technical.actions.manage', 'Gerenciar ações técnicas'),
  ('technical.actions.reopen', 'Reabrir ações técnicas'),
  ('technical.followup.view', 'Visualizar acompanhamento técnico-operacional'),
  ('technical.followup.manage', 'Registrar acompanhamento técnico-operacional'),
  ('technical.visits.view', 'Visualizar agenda e visitas técnicas'),
  ('technical.visits.manage', 'Criar, registrar e atualizar visitas técnicas'),
  ('technical.visits.cancel', 'Cancelar visitas técnicas'),
  ('technical.measurements.manage', 'Registrar avaliações e medições'),
  ('technical.pieces.edit_released', 'Editar peças já liberadas'),
  ('technical.pieces.release', 'Liberar peças'),
  ('technical.reports.view', 'Visualizar relatórios técnicos'),
  ('technical.reports.generate', 'Gerar relatórios e planilha-resumo'),
  ('technical.corrections.view', 'Visualizar correções técnicas'),
  ('technical.corrections.manage', 'Gerenciar correções técnicas'),
  ('technical.prods.view', 'Visualizar PRODs técnicos'),
  ('technical.prods.manage', 'Montar e gerenciar PRODs técnicos'),
  ('technical.prods.check', 'Conferir PRODs técnicos'),
  ('technical.prods.approve', 'Aprovar PRODs técnicos'),
  ('technical.prods.change_approved', 'Alterar PROD aprovado'),
  ('technical.deliveries.suprimentos_confirm', 'Confirmar listas recebidas por Suprimentos'),
  ('technical.deliveries.producao_confirm', 'Confirmar ordens recebidas pela Produção'),
  ('technical.doubts.view', 'Consultar bases de dúvidas técnicas'),
  ('technical.doubts.manage', 'Criar, responder e publicar dúvidas frequentes'),
  ('technical.audit.view', 'Consultar auditoria do módulo técnico'),
  ('technical.settings.manage', 'Gerenciar parâmetros técnicos'),
  ('technical.permissions.manage', 'Gerenciar permissões técnicas')
on conflict (key) do update set description = excluded.description;

with company as (
  select id from public.companies order by created_at limit 1
)
insert into public.roles (company_id, name, description, is_master_role, active)
select company.id, role_name, description, is_master, true
from company
cross join (
  values
    ('Administrador', 'Acesso absoluto à plataforma', true),
    ('Gestor Técnico', 'Gestão técnica, aprovação e parâmetros', false),
    ('Técnico', 'Operação técnica, visitas, medições, liberações e PRODs', false),
    ('Acompanhamento Técnico-Operacional', 'Ata, ações, acompanhamento e agenda', false),
    ('Suprimentos', 'Recebimento e conferência de listas', false),
    ('Produção', 'Recebimento e dúvidas de ordens de produção', false),
    ('Obras/Instalações', 'Perfil preparado para integração futura', false)
) as roles(role_name, description, is_master)
on conflict (company_id, name) do update set
  description = excluded.description,
  is_master_role = excluded.is_master_role,
  active = true;

with company as (
  select id from public.companies order by created_at limit 1
),
role_permissions_map(role_name, permission_key) as (
  values
    ('Gestor Técnico', 'technical.dashboard.view'),
    ('Gestor Técnico', 'technical.contracts.view'),
    ('Gestor Técnico', 'technical.contracts.manual_create'),
    ('Gestor Técnico', 'technical.contracts.edit'),
    ('Gestor Técnico', 'technical.contracts.delete_request'),
    ('Gestor Técnico', 'technical.financial.view'),
    ('Gestor Técnico', 'technical.folder.receive'),
    ('Gestor Técnico', 'technical.meetings.manage'),
    ('Gestor Técnico', 'technical.actions.view'),
    ('Gestor Técnico', 'technical.actions.manage'),
    ('Gestor Técnico', 'technical.actions.reopen'),
    ('Gestor Técnico', 'technical.followup.view'),
    ('Gestor Técnico', 'technical.followup.manage'),
    ('Gestor Técnico', 'technical.visits.view'),
    ('Gestor Técnico', 'technical.visits.manage'),
    ('Gestor Técnico', 'technical.visits.cancel'),
    ('Gestor Técnico', 'technical.measurements.manage'),
    ('Gestor Técnico', 'technical.pieces.edit_released'),
    ('Gestor Técnico', 'technical.pieces.release'),
    ('Gestor Técnico', 'technical.reports.view'),
    ('Gestor Técnico', 'technical.reports.generate'),
    ('Gestor Técnico', 'technical.corrections.view'),
    ('Gestor Técnico', 'technical.corrections.manage'),
    ('Gestor Técnico', 'technical.prods.view'),
    ('Gestor Técnico', 'technical.prods.manage'),
    ('Gestor Técnico', 'technical.prods.check'),
    ('Gestor Técnico', 'technical.prods.approve'),
    ('Gestor Técnico', 'technical.prods.change_approved'),
    ('Gestor Técnico', 'technical.doubts.view'),
    ('Gestor Técnico', 'technical.doubts.manage'),
    ('Gestor Técnico', 'technical.audit.view'),
    ('Gestor Técnico', 'technical.settings.manage'),
    ('Técnico', 'technical.dashboard.view'),
    ('Técnico', 'technical.contracts.view'),
    ('Técnico', 'technical.contracts.import_pdf'),
    ('Técnico', 'technical.actions.view'),
    ('Técnico', 'technical.followup.view'),
    ('Técnico', 'technical.visits.view'),
    ('Técnico', 'technical.visits.manage'),
    ('Técnico', 'technical.visits.cancel'),
    ('Técnico', 'technical.measurements.manage'),
    ('Técnico', 'technical.pieces.release'),
    ('Técnico', 'technical.reports.view'),
    ('Técnico', 'technical.reports.generate'),
    ('Técnico', 'technical.corrections.view'),
    ('Técnico', 'technical.prods.view'),
    ('Técnico', 'technical.prods.manage'),
    ('Técnico', 'technical.prods.check'),
    ('Técnico', 'technical.doubts.view'),
    ('Técnico', 'technical.doubts.manage'),
    ('Acompanhamento Técnico-Operacional', 'technical.dashboard.view'),
    ('Acompanhamento Técnico-Operacional', 'technical.contracts.view'),
    ('Acompanhamento Técnico-Operacional', 'technical.folder.receive'),
    ('Acompanhamento Técnico-Operacional', 'technical.meetings.manage'),
    ('Acompanhamento Técnico-Operacional', 'technical.actions.view'),
    ('Acompanhamento Técnico-Operacional', 'technical.actions.manage'),
    ('Acompanhamento Técnico-Operacional', 'technical.followup.view'),
    ('Acompanhamento Técnico-Operacional', 'technical.followup.manage'),
    ('Acompanhamento Técnico-Operacional', 'technical.visits.view'),
    ('Acompanhamento Técnico-Operacional', 'technical.visits.manage'),
    ('Acompanhamento Técnico-Operacional', 'technical.visits.cancel'),
    ('Acompanhamento Técnico-Operacional', 'technical.doubts.view'),
    ('Suprimentos', 'technical.dashboard.view'),
    ('Suprimentos', 'technical.prods.view'),
    ('Suprimentos', 'technical.deliveries.suprimentos_confirm'),
    ('Suprimentos', 'technical.doubts.view'),
    ('Produção', 'technical.dashboard.view'),
    ('Produção', 'technical.prods.view'),
    ('Produção', 'technical.deliveries.producao_confirm'),
    ('Produção', 'technical.doubts.view'),
    ('Produção', 'technical.doubts.manage'),
    ('Obras/Instalações', 'technical.doubts.view')
)
insert into public.role_permissions (company_id, role_id, permission_id)
select company.id, role.id, permission.id
from company
join role_permissions_map map on true
join public.roles role on role.company_id = company.id and role.name = map.role_name
join public.permissions permission on permission.key = map.permission_key
on conflict (company_id, role_id, permission_id) do nothing;

with company as (
  select id from public.companies order by created_at limit 1
)
insert into public.technical_settings (company_id, key, value, description)
select company.id, key, value::jsonb, description
from company
cross join (
  values
    ('prazo_tecnico_dias_uteis', '10', 'Prazo Técnico padrão em dias úteis'),
    ('prazo_suprimentos_dias_uteis', '35', 'Prazo Suprimentos em dias úteis'),
    ('prazo_producao_dias_uteis', '15', 'Prazo Produção em dias úteis'),
    ('faixas_risco', '[{"key":"atencao","percentual":70},{"key":"risco","percentual":90},{"key":"atrasado","percentual":100}]', 'Faixas de risco do contrato'),
    ('tipos_visita', '["Inicial","Medição","Conferência","Retorno","Correção"]', 'Tipos básicos de visita'),
    ('status_iniciais', '["aguardando_pasta","aguardando_reuniao","em_acompanhamento"]', 'Status iniciais do fluxo técnico'),
    ('categorias_documentos', '["lista_materiais","ordem_producao","planilha_resumo","relatorio_visita"]', 'Categorias básicas de documentos')
) as settings(key, value, description)
on conflict (company_id, key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

with company as (
  select id from public.companies order by created_at limit 1
)
insert into public.technical_doubt_categories (company_id, area, name, sort_order)
select company.id, area, name, sort_order
from company
cross join (
  values
    ('producao', 'CEM', 1),
    ('producao', 'Medidas', 2),
    ('producao', 'Materiais', 3),
    ('obras_instalacoes', 'Vãos', 1),
    ('obras_instalacoes', 'Instalação', 2),
    ('obras_instalacoes', 'Acesso à obra', 3)
) as categories(area, name, sort_order)
on conflict (company_id, area, name) do update set
  sort_order = excluded.sort_order,
  active = true;
