begin;
alter table public.technical_contract_pieces
  add column if not exists forecast_date date,
  add column if not exists forecast_group uuid;

create or replace function public.technical_plan_release(co uuid, cid uuid, actor uuid, selected uuid[], planned date, seen jsonb)
returns void language plpgsql set search_path=public as $$
declare
  grp uuid := gen_random_uuid(); p record; changed integer := 0;
begin
  if cardinality(selected) is null or cardinality(selected)<1 or planned is null or planned < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Selecione peças pendentes e uma previsão para hoje ou depois.';
  end if;
  if not exists(select 1 from public.production_contracts where company_id=co and id=cid and active) then raise exception 'Obra inativa.'; end if;
  perform 1 from public.technical_contracts where company_id=co and contract_id=cid and deleted_at is null and technical_status not in ('cancelado','concluido') for update;
  if not found then raise exception 'Obra indisponível.'; end if;
  for p in select id,forecast_date,forecast_group from public.technical_contract_pieces
    where company_id=co and contract_id=cid and id=any(selected) and deleted_at is null and active_prod_batch_id is null
      and status not in ('liberada','em_prod','entregue','cancelada') order by id for update loop
    if not (seen ? p.id::text) or (seen->>p.id::text) is distinct from p.forecast_group::text then
      raise exception 'A previsão mudou. Atualize a página e confira o saldo.';
    end if;
    changed:=changed+1;
    update public.technical_contract_pieces set forecast_date=planned,forecast_group=grp where id=p.id;
    insert into public.audit_logs(company_id,entity,entity_id,action,user_id,before_data,after_data,notes)
      values(co,'technical_contract_pieces',p.id,'release_forecast',actor,jsonb_build_object('date',p.forecast_date,'group',p.forecast_group),
      jsonb_build_object('date',planned,'group',grp),'Previsão de liberação registrada para o PCP.');
  end loop;
  if changed <> cardinality(selected) then raise exception 'O saldo mudou. Atualize a página para planejar as peças pendentes.'; end if;
end $$;
revoke all on function public.technical_plan_release(uuid,uuid,uuid,uuid[],date,jsonb) from public,anon,authenticated;
grant execute on function public.technical_plan_release(uuid,uuid,uuid,uuid[],date,jsonb) to service_role;
commit;
