begin;
create or replace function public.technical_correct_work_data(co uuid,cid uuid,actor uuid,changes jsonb,seen jsonb,reason text)
returns integer language plpgsql set search_path=public as $$
declare c production_contracts%rowtype; n production_contracts%rowtype; client_name_now text; new_client uuid; before_diff jsonb:='{}'; after_diff jsonb:='{}'; k text; old_value jsonb; all_applied boolean:=true; count_changes integer:=0;
begin
 if length(trim(coalesce(reason,'')))<5 then raise exception 'Informe o motivo do ajuste.';end if;
 if changes is null or jsonb_typeof(changes)<>'object' or seen is null or jsonb_typeof(seen)<>'object' then raise exception 'Dados de correção inválidos.';end if;
 select * into strict c from production_contracts where id=cid and company_id=co for update;
 select name into client_name_now from clients where id=c.client_id and company_id=co;
 for k in select jsonb_object_keys(changes) loop
  if k<>all(array['client_name','work_name','full_address','city','state','zip_code','site_contact','site_contact_phone','notes']) or not(seen ? k) then raise exception 'Campo de correção inválido.';end if;
  if jsonb_typeof(changes->k) not in ('string','null') then raise exception 'Valor inválido.';end if;
  old_value:=case when k='client_name' then coalesce(to_jsonb(client_name_now),'null'::jsonb) else to_jsonb(c)->k end;
  if old_value is distinct from changes->k then all_applied:=false;end if;
 end loop;
 -- A retry after a lost response must not duplicate a successful correction.
 if all_applied then return 0;end if;
 for k in select jsonb_object_keys(changes) loop
  old_value:=case when k='client_name' then coalesce(to_jsonb(client_name_now),'null'::jsonb) else to_jsonb(c)->k end;
  if old_value is distinct from seen->k then raise exception 'O cadastro mudou desde a abertura. Recarregue e confira antes de salvar.';end if;
  if old_value is distinct from changes->k then
   before_diff:=before_diff||jsonb_build_object(k,old_value);after_diff:=after_diff||jsonb_build_object(k,changes->k);count_changes:=count_changes+1;
  end if;
 end loop;
 if after_diff ? 'client_name' then
  if length(trim(coalesce(after_diff->>'client_name','')))=0 then raise exception 'Informe o cliente.';end if;
  select id into new_client from clients where company_id=co and lower(name)=lower(after_diff->>'client_name') for update;
  if new_client is null then
   insert into clients(company_id,name,trade_name,active,created_by) values(co,after_diff->>'client_name',null,true,actor) returning id into new_client;
  else update clients set name=after_diff->>'client_name' where id=new_client and company_id=co;end if;
 else new_client:=c.client_id;end if;
 select * into n from jsonb_populate_record(c,after_diff-'client_name');
 if length(trim(coalesce(n.work_name,'')))=0 or length(trim(coalesce(n.full_address,'')))=0 or length(trim(coalesce(n.city,'')))=0 or length(coalesce(n.state,''))<>2 then raise exception 'Confira os campos obrigatórios da obra.';end if;
 update production_contracts set client_id=new_client,work_name=n.work_name,full_address=n.full_address,city=n.city,state=n.state,zip_code=n.zip_code,site_contact=n.site_contact,site_contact_phone=n.site_contact_phone,notes=n.notes where id=cid and company_id=co;
 insert into audit_logs(company_id,entity,entity_id,action,user_id,before_data,after_data,notes) values(co,'production_contracts',cid,'work_data_update',actor,before_diff,after_diff,'Correção autorizada dos dados da obra. Motivo: '||trim(reason));
 return count_changes;
end $$;
revoke all on function public.technical_correct_work_data(uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.technical_correct_work_data(uuid,uuid,uuid,jsonb,jsonb,text) to service_role;
commit;
