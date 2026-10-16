-- Carga manual, idempotente e exclusiva da obra 26-0715.
-- Nao executar como migration automatica.

begin;

do $$
declare
  v_contract public.production_contracts%rowtype;
  v_prod public.technical_prod_batches%rowtype;
  v_piece_count integer;
  v_matching_piece_count integer;
  v_existing_count integer;
  v_matching_measurement_count integer;
  v_actor_profile_id uuid;
  v_actor_user_id uuid;
  v_inserted boolean := false;
begin
  begin
    select contract.*
    into strict v_contract
    from public.production_contracts contract
    where btrim(contract.contract_number) = '26-0715';
  exception
    when no_data_found then
      raise exception 'Contrato 26-0715 nao encontrado.';
    when too_many_rows then
      raise exception 'Mais de um contrato 26-0715 foi encontrado.';
  end;

  begin
    select prod.*
    into strict v_prod
    from public.technical_prod_batches prod
    where prod.company_id = v_contract.company_id
      and prod.contract_id = v_contract.id
      and btrim(prod.batch_number) = '26-0715_PROD1'
      and prod.deleted_at is null
    for update;
  exception
    when no_data_found then
      raise exception 'PROD 26-0715_PROD1 nao encontrada.';
    when too_many_rows then
      raise exception 'Mais de uma PROD 26-0715_PROD1 foi encontrada.';
  end;

  if v_prod.status <> 'aprovado' then
    raise exception 'A PROD 26-0715_PROD1 deve permanecer aprovada. Status atual: %.', v_prod.status;
  end if;

  select count(*)
  into v_piece_count
  from public.technical_prod_batch_pieces link
  join public.technical_contract_pieces piece on piece.id = link.piece_id
  where link.prod_batch_id = v_prod.id
    and piece.deleted_at is null;

  if v_piece_count <> 4 then
    raise exception 'A PROD deve conter exatamente quatro pecas ativas. Encontradas: %.', v_piece_count;
  end if;

  with expected(code_key, sale_width, sale_height, field_width, field_height) as (
    values
      ('P1', 1063::numeric, 3454::numeric, 1063::numeric, 3454::numeric),
      ('FIXO1', 4920::numeric, 4020::numeric, 4920::numeric, 4020::numeric),
      ('FIXO2', 520::numeric, 4020::numeric, 520::numeric, 4020::numeric),
      ('FIXO3', 2200::numeric, 806::numeric, 2200::numeric, 810::numeric)
  )
  select count(*)
  into v_matching_piece_count
  from expected
  join public.technical_contract_pieces piece
    on regexp_replace(upper(coalesce(piece.code, '')), '[^A-Z0-9]', '', 'g') = expected.code_key
  join public.technical_prod_batch_pieces link
    on link.piece_id = piece.id
   and link.prod_batch_id = v_prod.id
  where piece.contract_id = v_contract.id
    and piece.company_id = v_contract.company_id
    and piece.deleted_at is null
    and piece.sale_width_mm = expected.sale_width
    and piece.sale_height_mm = expected.sale_height
    and piece.measured_width_mm = expected.field_width
    and piece.measured_height_mm = expected.field_height;

  if v_matching_piece_count <> 4 then
    raise exception 'Codigos ou medidas de venda/campo da Beoos nao correspondem ao plano aprovado. Carga cancelada.';
  end if;

  select count(*)
  into v_existing_count
  from public.technical_prod_piece_manufacturing_measurements measurement
  where measurement.prod_batch_id = v_prod.id;

  with expected(code_key, manufacturing_width, manufacturing_height) as (
    values
      ('P1', 1057::numeric, 3450::numeric),
      ('FIXO1', 4920::numeric, 4020::numeric),
      ('FIXO2', 520::numeric, 4020::numeric),
      ('FIXO3', 2200::numeric, 810::numeric)
  )
  select count(*)
  into v_matching_measurement_count
  from expected
  join public.technical_contract_pieces piece
    on regexp_replace(upper(coalesce(piece.code, '')), '[^A-Z0-9]', '', 'g') = expected.code_key
  join public.technical_prod_piece_manufacturing_measurements measurement
    on measurement.piece_id = piece.id
   and measurement.prod_batch_id = v_prod.id
   and measurement.prod_revision = 1
  where measurement.manufacturing_width_mm = expected.manufacturing_width
    and measurement.manufacturing_height_mm = expected.manufacturing_height;

  if v_prod.current_revision = 1 and v_existing_count = 4 and v_matching_measurement_count = 4 then
    raise notice 'Carga Beoos ja aplicada com os mesmos valores. Nenhuma alteracao realizada.';
    return;
  end if;

  if v_prod.current_revision <> 0 or v_existing_count <> 0 then
    raise exception 'Ja existem revisoes de fabricacao diferentes da carga inicial esperada. Revisao atual: %, registros: %.',
      v_prod.current_revision,
      v_existing_count;
  end if;

  v_actor_profile_id := coalesce(v_prod.approved_by_profile_id, v_prod.checked_by_profile_id);
  select profile.user_id
  into v_actor_user_id
  from public.profiles profile
  where profile.id = v_actor_profile_id;

  with expected(code_key, manufacturing_width, manufacturing_height) as (
    values
      ('P1', 1057::numeric, 3450::numeric),
      ('FIXO1', 4920::numeric, 4020::numeric),
      ('FIXO2', 520::numeric, 4020::numeric),
      ('FIXO3', 2200::numeric, 810::numeric)
  )
  insert into public.technical_prod_piece_manufacturing_measurements (
    company_id,
    contract_id,
    prod_batch_id,
    piece_id,
    prod_revision,
    manufacturing_width_mm,
    manufacturing_height_mm,
    change_reason,
    recorded_by_profile_id
  )
  select
    v_contract.company_id,
    v_contract.id,
    v_prod.id,
    piece.id,
    1,
    expected.manufacturing_width,
    expected.manufacturing_height,
    'Carga inicial homologada das medidas efetivas de fabricacao/CEM da Beoos.',
    v_actor_profile_id
  from expected
  join public.technical_contract_pieces piece
    on regexp_replace(upper(coalesce(piece.code, '')), '[^A-Z0-9]', '', 'g') = expected.code_key
  join public.technical_prod_batch_pieces link
    on link.piece_id = piece.id
   and link.prod_batch_id = v_prod.id;

  update public.technical_prod_batches
  set current_revision = 1
  where id = v_prod.id
    and company_id = v_contract.company_id
    and current_revision = 0;

  if not found then
    raise exception 'A revisao da PROD mudou durante a carga. Operacao cancelada.';
  end if;

  v_inserted := true;

  if v_inserted and not exists (
    select 1
    from public.audit_logs audit
    where audit.company_id = v_contract.company_id
      and audit.entity = 'technical_prod_batches'
      and audit.entity_id = v_contract.id
      and audit.action = 'prod_manufacturing_measurements_revision'
      and audit.after_data ->> 'source_marker' = 'beoos-cem-baseline-v1'
  ) then
    insert into public.audit_logs (
      company_id,
      entity,
      entity_id,
      action,
      user_id,
      before_data,
      after_data,
      notes
    ) values (
      v_contract.company_id,
      'technical_prod_batches',
      v_contract.id,
      'prod_manufacturing_measurements_revision',
      v_actor_user_id,
      jsonb_build_object(
        'prod_batch_id', v_prod.id,
        'batch_number', v_prod.batch_number,
        'revision', 0,
        'status', v_prod.status
      ),
      jsonb_build_object(
        'prod_batch_id', v_prod.id,
        'batch_number', v_prod.batch_number,
        'revision', 1,
        'status', v_prod.status,
        'source_marker', 'beoos-cem-baseline-v1'
      ),
      'Carga inicial homologada das medidas efetivas de fabricacao/CEM da Beoos. [beoos-cem-baseline-v1]'
    );
  end if;
end;
$$;

commit;
