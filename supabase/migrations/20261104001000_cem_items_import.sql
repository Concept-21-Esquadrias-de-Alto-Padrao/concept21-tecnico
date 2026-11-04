begin;
alter table public.technical_prod_batches add column if not exists cem_report jsonb;
create or replace function public.technical_import_cem_items(co uuid,cid uuid,actor uuid,num text,report jsonb)
returns text language plpgsql set search_path=public as $$
declare b technical_prod_batches%rowtype; p technical_contract_pieces%rowtype; r technical_releases%rowtype;
  item jsonb; ids uuid[]:='{}'; existing boolean;
begin
  perform 1 from production_contracts where id=cid and company_id=co and active for update;
  if not found then raise exception 'Contrato indisponível.'; end if;
  if nullif(trim(num),'') is null or jsonb_typeof(report->'rows') is distinct from 'array' or jsonb_array_length(report->'rows')=0 then raise exception 'Relatório vazio.'; end if;
  select * into b from technical_prod_batches where contract_id=cid and company_id=co and upper(trim(batch_number))=upper(trim(num)) for update;
  existing:=found;
  if existing and (b.deleted_at is not null or b.status='cancelado') then raise exception 'PROD cancelada.'; end if;
  if existing and b.cem_report is not null then
    if b.cem_report->>'digest'=report->>'digest' then return 'Este relatório já está registrado nesta PROD.'; end if;
    raise exception 'Esta PROD já possui outro relatório. Encaminhe a revisão ao responsável.';
  end if;
  for item in select value from jsonb_array_elements(report->'rows') order by value->>'pieceId' loop
    select * into p from technical_contract_pieces where id=(item->>'pieceId')::uuid and company_id=co and contract_id=cid and deleted_at is null for update;
    if not found or p.status='cancelada' or p.id=any(ids) or upper(trim(p.code))<>upper(trim(item->>'code')) or p.quantity<>(item->>'quantity')::integer then raise exception 'O cadastro da peça % mudou. Refaça a leitura.',item->>'code'; end if;
    ids:=array_append(ids,p.id);
    if existing then
      if p.active_prod_batch_id is distinct from b.id then raise exception 'Peças divergentes da PROD existente.'; end if;
    else
      if p.active_prod_batch_id is not null or p.status<>'liberada' or p.released_at is null or p.project_only or coalesce(p.measured_width_mm,0)<=0 or coalesce(p.measured_height_mm,0)<=0 or not(p.cem_registered and p.cem_checked) then raise exception 'Peça % indisponível para emissão.',p.code; end if;
      if exists(select 1 from technical_corrections where company_id=co and contract_id=cid and piece_id=p.id and deleted_at is null and blocking and status not in ('encerrada','cancelada')) then raise exception 'Correção bloqueante na peça %.',p.code; end if;
      select tr.* into r from technical_release_pieces l join technical_releases tr on tr.id=l.release_id where l.piece_id=p.id and tr.company_id=co and tr.contract_id=cid order by l.created_at desc,l.id limit 1 for share of tr;
      if not found or r.status='cancelado' or (r.validation_required and r.status<>'validado' and
        (not exists(select 1 from technical_release_participants where release_id=r.id) or exists(select 1 from technical_release_participants where release_id=r.id and signed_at is null))) then raise exception 'Verifique o lote de liberação e as assinaturas da peça %.',p.code; end if;
    end if;
  end loop;
  if existing then
    if (select count(*) from technical_prod_batch_pieces where prod_batch_id=b.id and piece_id=any(ids))<>cardinality(ids)
      or exists(select 1 from technical_prod_batch_pieces where prod_batch_id=b.id and not(piece_id=any(ids))) then raise exception 'As peças do relatório divergem da PROD existente.'; end if;
    update technical_prod_batches set cem_report=report where id=b.id;
  else
    insert into technical_prod_batches(company_id,contract_id,batch_number,status,cem_registered,cem_checked,cem_report)
      values(co,cid,num,'aguardando_conferencia',true,true,report) returning * into b;
    insert into technical_prod_batch_pieces(prod_batch_id,piece_id) select b.id,unnest(ids);
    update technical_contract_pieces set active_prod_batch_id=b.id,status='em_prod' where id=any(ids);
  end if;
  insert into audit_logs(company_id,entity,entity_id,action,user_id,notes) values(co,'technical_prod_batches',b.id,'import_cem_items',actor,'Relatório Itens da Obra conferido e registrado.');
  return case when existing then 'Relatório vinculado à PROD existente.' else 'PROD registrada e encaminhada para conferência.' end;
end $$;
revoke all on function public.technical_import_cem_items(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.technical_import_cem_items(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
