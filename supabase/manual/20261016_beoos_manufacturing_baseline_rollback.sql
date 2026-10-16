-- Rollback manual da carga inicial da Beoos.
-- Usar somente antes de qualquer nova revisao registrada por usuario.

begin;

do $$
declare
  v_contract_id uuid;
  v_company_id uuid;
  v_prod_id uuid;
  v_current_revision integer;
  v_measurement_count integer;
begin
  select contract.id, contract.company_id
  into strict v_contract_id, v_company_id
  from public.production_contracts contract
  where btrim(contract.contract_number) = '26-0715';

  select prod.id, prod.current_revision
  into strict v_prod_id, v_current_revision
  from public.technical_prod_batches prod
  where prod.company_id = v_company_id
    and prod.contract_id = v_contract_id
    and btrim(prod.batch_number) = '26-0715_PROD1'
    and prod.deleted_at is null
  for update;

  select count(*)
  into v_measurement_count
  from public.technical_prod_piece_manufacturing_measurements measurement
  where measurement.prod_batch_id = v_prod_id;

  if v_current_revision <> 1 or v_measurement_count <> 4 then
    raise exception 'Rollback bloqueado: a PROD possui revisoes posteriores ou dados diferentes da carga inicial.';
  end if;

  if exists (
    select 1
    from public.technical_prod_piece_manufacturing_measurements measurement
    where measurement.prod_batch_id = v_prod_id
      and measurement.prod_revision <> 1
  ) then
    raise exception 'Rollback bloqueado: existe revisao posterior de fabricacao.';
  end if;

  delete from public.audit_logs audit
  where audit.company_id = v_company_id
    and audit.entity = 'technical_prod_batches'
    and audit.entity_id = v_contract_id
    and audit.action = 'prod_manufacturing_measurements_revision'
    and audit.after_data ->> 'source_marker' = 'beoos-cem-baseline-v1';

  delete from public.technical_prod_piece_manufacturing_measurements measurement
  where measurement.prod_batch_id = v_prod_id
    and measurement.prod_revision = 1;

  update public.technical_prod_batches
  set current_revision = 0
  where id = v_prod_id
    and company_id = v_company_id
    and current_revision = 1;
end;
$$;

commit;
