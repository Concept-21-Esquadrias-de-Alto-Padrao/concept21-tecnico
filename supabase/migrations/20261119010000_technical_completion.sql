-- Encerramento técnico preserva execução física e histórico.
begin;
CREATE OR REPLACE FUNCTION public.technical_guard_fabrication_preview()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare s technical_fabrication_sets%rowtype; imp technical_fabrication_imports%rowtype; ids uuid[];
begin
 if new.status='concluido' then
  if tg_op<>'UPDATE' then raise exception 'A PROD deve ser aprovada antes do encerramento técnico.'; end if;
  if old.status not in ('aprovado','entregue_suprimentos','entregue_producao','concluido') or new.checked_at is null or new.checked_by_profile_id is null or new.approved_at is null or new.approved_by_profile_id is null then raise exception 'Conferência e aprovação obrigatórias para concluir no Técnico.'; end if;
  if not exists(select 1 from technical_prod_batch_pieces bp where bp.prod_batch_id=new.id) then raise exception 'PROD sem peças não pode ser concluída.'; end if;
  if exists(select 1 from (values ('suprimentos','lista_materiais'),('producao','ordem_producao')) required(department,kind) where not exists(select 1 from technical_department_deliveries d join technical_department_confirmations f on f.delivery_id=d.id where d.prod_batch_id=new.id and d.company_id=new.company_id and d.department=required.department and d.delivery_type=required.kind and d.status='confirmado' and f.status='confirmado' and d.id=(select d2.id from technical_department_deliveries d2 where d2.prod_batch_id=new.id and d2.department=required.department order by coalesce(d2.delivered_at,d2.created_at) desc,d2.id desc limit 1))) then raise exception 'Confirme os últimos recebimentos de Suprimentos e Produção antes de concluir no Técnico.'; end if;
 end if;
 if not coalesce(new.cem_report ? 'fabricationSetId',false) then return new; end if;
 if new.status='rascunho' then return new; end if;
 select * into s from technical_fabrication_sets where id=(new.cem_report->>'fabricationSetId')::uuid and company_id=new.company_id and contract_id=new.contract_id;
 if not found or not s.workflow_ready then raise exception 'Conjunto ainda não encaminhado para conferência.'; end if;
 if new.status='cancelado' then raise exception 'Cancelamento de conjunto exige revisão dos vínculos e saldos.'; end if;
 select * into strict imp from technical_fabrication_imports where set_id=s.id and prod_batch_id=new.id;
 select array_agg(distinct piece_id) into ids from (select piece_id from technical_fabrication_set_sources where set_id=s.id union select piece_id from technical_fabrication_items where import_id=imp.id and piece_id is not null) q;
 if (select count(*) from technical_prod_batch_pieces where prod_batch_id=new.id)<>cardinality(ids) or exists(select 1 from technical_contract_pieces where id=any(ids) and (active_prod_batch_id is distinct from new.id or status not in ('em_prod','entregue'))) then raise exception 'Saldo ou vínculo divergente do conjunto.'; end if;
 if tg_op='UPDATE' and new.status<>old.status then
  if not((old.status='rascunho' and new.status='aguardando_conferencia') or (old.status='aguardando_conferencia' and new.status='aguardando_aprovacao') or (old.status='aguardando_aprovacao' and new.status='aprovado') or (old.status in ('aprovado','entregue_suprimentos','entregue_producao') and new.status='concluido')) then raise exception 'Transição inválida para o conjunto.'; end if;
 end if;
 if new.status in ('aguardando_aprovacao','aprovado') and (not new.cem_registered or not new.cem_checked or new.checked_at is null or new.checked_by_profile_id is null) then raise exception 'Conferência técnica obrigatória.'; end if;
 if new.status='aprovado' and (tg_op='INSERT' or old.status is distinct from 'aprovado') then
  if new.approved_by_profile_id is null or new.approved_at is null then raise exception 'Aprovação sem responsável ou data.'; end if;
  new.approved_snapshot:=coalesce(new.approved_snapshot,'{}'::jsonb)||jsonb_build_object('fabricationSet',to_jsonb(s),'fabricationItems',(select jsonb_agg(to_jsonb(i)) from technical_fabrication_items i where import_id=imp.id),'externalServices',(select jsonb_agg(to_jsonb(e)) from technical_piece_external_services e where company_id=new.company_id and contract_id=new.contract_id),'scopeConfirmation',(select after_data from audit_logs where entity_id=s.id and action='fabrication_scope_confirmed' order by created_at desc limit 1));
 end if;
 return new;
end $function$
;
commit;
