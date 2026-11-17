begin;
create or replace function public.technical_import_split_prod(co uuid,cid uuid,actor uuid,num text,report jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare b technical_prod_batches%rowtype; p technical_contract_pieces%rowtype; release_row technical_releases%rowtype;
sid uuid; iid uuid; rowdata jsonb; source_code text; source_ids uuid[]:='{}'; source_codes text[]; draft jsonb; historical boolean; source_units integer:=0; count_rows integer; production_units integer;
begin
 perform 1 from production_contracts where id=cid and company_id=co and active for update;
 if not found then raise exception 'Contrato indisponível.';end if;
 if not exists(select 1 from profiles where user_id=actor and company_id=co and status='active') then raise exception 'Responsável indisponível.';end if;
 if not exists(select 1 from profiles pr where pr.user_id=actor and pr.company_id=co and pr.status='active' and (pr.is_master or exists(select 1 from user_roles ur join roles rr on rr.id=ur.role_id where ur.profile_id=pr.id and ur.company_id=co and ur.active and rr.active and (rr.is_master_role or exists(select 1 from role_permissions rp join permissions pe on pe.id=rp.permission_id where rp.role_id=rr.id and rp.company_id=co and pe.key='technical.prods.manage'))))) then raise exception 'Sem permissão para importar PROD.';end if;
 historical:=coalesce((report->>'historical_regularization')::boolean,false);
 if historical and nullif(trim(report->>'historical_confirmation'),'') is null then raise exception 'Regularização histórica exige confirmação registrada.';end if;
 if nullif(trim(num),'') is null or length(num)>100 or report->>'batchNumber' is distinct from num or report->>'digest' !~ '^[a-f0-9]{64}$' or jsonb_typeof(report->'rows') is distinct from 'array' or report->>'coverage' is distinct from 'total' then raise exception 'Confira relatório, código e cobertura integral.';end if;
 count_rows:=jsonb_array_length(report->'rows');
 if count_rows=0 or count_rows>500 or count_rows<>(select count(distinct value->>'code') from jsonb_array_elements(report->'rows')) then raise exception 'Relatório vazio ou itens duplicados.';end if;
 select * into b from technical_prod_batches where company_id=co and contract_id=cid and upper(trim(batch_number))=upper(trim(num)) for update;
 if found then
  if b.deleted_at is null and b.status<>'cancelado' and b.cem_report->>'digest'=report->>'digest' and b.cem_report->'rows'=report->'rows' then return jsonb_build_object('prodId',b.id,'duplicate',true);end if;
  raise exception 'Esta PROD já existe com outro relatório ou foi cancelada. Use revisão.';
 end if;
 if exists(select 1 from technical_prod_batches where company_id=co and contract_id=cid and deleted_at is null and status<>'cancelado' and cem_report->>'digest'=report->>'digest') then raise exception 'PDF já registrado em outra PROD.';end if;
 select array_agg(distinct value->>'contractCode' order by value->>'contractCode'),sum((value->>'quantity')::integer) into source_codes,production_units from jsonb_array_elements(report->'rows');
 for rowdata in select value from jsonb_array_elements(report->'rows') loop
  if nullif(trim(rowdata->>'code'),'') is null or nullif(trim(rowdata->>'contractCode'),'') is null or coalesce((rowdata->>'quantity')::integer,0)<=0 or coalesce((rowdata->>'width')::numeric,0)<=0 or coalesce((rowdata->>'height')::numeric,0)<=0 or coalesce((rowdata->>'area')::numeric,-1)<0 or coalesce((rowdata->>'weight')::numeric,-1)<0 then raise exception 'Item de fabricação inválido.';end if;
 end loop;
 foreach source_code in array source_codes loop
  select * into strict p from technical_contract_pieces where company_id=co and contract_id=cid and code=source_code and deleted_at is null for update;
  if p.status='cancelada' or p.active_prod_batch_id is not null or exists(select 1 from technical_prod_batch_pieces l join technical_prod_batches x on x.id=l.prod_batch_id where l.piece_id=p.id and x.deleted_at is null and x.status<>'cancelado') then raise exception 'Origem já consumida ou cancelada: %.',source_code;end if;
  if exists(select 1 from technical_corrections where company_id=co and contract_id=cid and piece_id=p.id and deleted_at is null and blocking and status not in ('encerrada','cancelada')) then raise exception 'Correção bloqueante: %.',p.code;end if;
  if technical_alignment_has_block(co,cid,'prods',p.id) then raise exception 'Pendência de alinhamento: %.',p.code;end if;
  if not historical then
   if p.status<>'liberada' or p.released_at is null then raise exception 'Liberação pendente: %.',p.code;end if;
   if not(p.project_only or p.measurement_not_required) and (coalesce(p.measured_width_mm,0)<=0 or coalesce(p.measured_height_mm,0)<=0) then raise exception 'Medidas de campo ausentes: %.',p.code;end if;
   select r.* into release_row from technical_release_pieces l join technical_releases r on r.id=l.release_id where l.piece_id=p.id and r.company_id=co and r.contract_id=cid order by l.created_at desc,l.id limit 1;
   if not found or release_row.status='cancelado' or (release_row.validation_required and release_row.status<>'validado' and (not exists(select 1 from technical_release_participants where release_id=release_row.id) or exists(select 1 from technical_release_participants where release_id=release_row.id and signed_at is null))) then raise exception 'Confira o lote de liberação: %.',p.code;end if;
  end if;
  source_ids:=array_append(source_ids,p.id);source_units:=source_units+p.quantity;
 end loop;
 select jsonb_build_object('name',num,'contractCodes',to_jsonb(source_codes),'fabricationCodes',jsonb_agg(value->>'code'),'links',jsonb_agg(jsonb_build_object('contractCode',value->>'contractCode','fabricationCode',value->>'code')),'coverage','total','pending','','projectReference',report->>'digest') into draft from jsonb_array_elements(report->'rows');
 insert into technical_fabrication_sets(company_id,contract_id,name,draft,created_by,updated_by) values(co,cid,num,draft,actor,actor) returning id into sid;
 insert into technical_fabrication_set_sources(set_id,piece_id) select sid,unnest(source_ids);
 insert into technical_prod_batches(company_id,contract_id,batch_number,status,cem_report,created_by) values(co,cid,num,'rascunho',report||jsonb_build_object('fabricationSetId',sid,'originLinks',draft->'links','sourceUnits',source_units,'manufacturingUnits',production_units),actor) returning * into b;
 insert into technical_fabrication_imports(set_id,prod_batch_id,digest,report,created_by) values(sid,b.id,report->>'digest',report,actor) returning id into iid;
 for rowdata in select value from jsonb_array_elements(report->'rows') loop
  insert into technical_fabrication_items(import_id,set_id,code,environment,quantity,width_mm,height_mm,area_m2,weight_kg) values(iid,sid,rowdata->>'code',rowdata->>'environment',(rowdata->>'quantity')::integer,(rowdata->>'width')::numeric,(rowdata->>'height')::numeric,(rowdata->>'area')::numeric,(rowdata->>'weight')::numeric);
 end loop;
 if (select count(*) from technical_fabrication_item_sources l join technical_fabrication_items i on i.id=l.item_id where i.import_id=iid)<>count_rows then raise exception 'Correspondências incompletas.';end if;
 insert into technical_prod_batch_pieces(prod_batch_id,piece_id) select b.id,unnest(source_ids);
 update technical_contract_pieces set active_prod_batch_id=b.id,status='em_prod',cem_registered=true,cem_checked=true where id=any(source_ids);
 update technical_fabrication_sets set workflow_ready=true where id=sid;
 update technical_prod_batches set status='aguardando_conferencia',cem_registered=true,cem_checked=true where id=b.id;
 insert into audit_logs(company_id,entity,entity_id,action,user_id,after_data,notes) values(co,'technical_prod_batches',b.id,'split_prod_imported',actor,jsonb_build_object('report',report,'sourcePieces',source_ids,'sourceUnits',source_units,'manufacturingUnits',production_units,'historical',historical),'Importação atômica com cobertura integral confirmada. Medidas e datas de campo preservadas; data desconhecida não substituída pela data do registro.');
 return jsonb_build_object('prodId',b.id,'setId',sid,'sourceUnits',source_units,'manufacturingUnits',production_units,'duplicate',false);
end $$;
revoke all on function public.technical_import_split_prod(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.technical_import_split_prod(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
