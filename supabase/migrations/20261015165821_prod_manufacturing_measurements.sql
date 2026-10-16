alter table public.technical_prod_batches
  add column if not exists current_revision integer not null default 0
  check (current_revision >= 0);

create table if not exists public.technical_prod_piece_manufacturing_measurements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.production_contracts(id) on delete cascade,
  prod_batch_id uuid not null references public.technical_prod_batches(id) on delete cascade,
  piece_id uuid not null references public.technical_contract_pieces(id) on delete restrict,
  prod_revision integer not null check (prod_revision > 0),
  manufacturing_width_mm numeric not null check (manufacturing_width_mm > 0),
  manufacturing_height_mm numeric not null check (manufacturing_height_mm > 0),
  change_reason text not null check (length(btrim(change_reason)) >= 5),
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (prod_batch_id, piece_id, prod_revision)
);

create index if not exists technical_prod_manufacturing_current_idx
  on public.technical_prod_piece_manufacturing_measurements(company_id, prod_batch_id, prod_revision desc);

create index if not exists technical_prod_manufacturing_piece_history_idx
  on public.technical_prod_piece_manufacturing_measurements(company_id, piece_id, created_at desc);

drop trigger if exists technical_prod_manufacturing_measurements_audit
on public.technical_prod_piece_manufacturing_measurements;

create trigger technical_prod_manufacturing_measurements_audit
after insert or update or delete on public.technical_prod_piece_manufacturing_measurements
for each row execute function public.audit_table_changes();

alter table public.technical_prod_piece_manufacturing_measurements enable row level security;

drop policy if exists technical_prod_manufacturing_measurements_read
on public.technical_prod_piece_manufacturing_measurements;

create policy technical_prod_manufacturing_measurements_read
on public.technical_prod_piece_manufacturing_measurements
for select to authenticated
using (
  company_id = public.current_company_id()
  and public.has_permission('technical.prods.view')
);

grant select on public.technical_prod_piece_manufacturing_measurements to authenticated;
grant all on public.technical_prod_piece_manufacturing_measurements to service_role;

create or replace function public.save_prod_manufacturing_measurement_revision(
  p_company_id uuid,
  p_prod_batch_id uuid,
  p_recorded_by_profile_id uuid,
  p_auth_user_id uuid,
  p_change_reason text,
  p_measurements jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prod public.technical_prod_batches%rowtype;
  v_next_revision integer;
  v_piece_count integer;
  v_measurement_count integer;
begin
  if length(btrim(coalesce(p_change_reason, ''))) < 5 then
    raise exception 'Informe um motivo com pelo menos 5 caracteres.';
  end if;

  if jsonb_typeof(p_measurements) <> 'array' then
    raise exception 'As medidas de fabricação são inválidas.';
  end if;

  select *
  into v_prod
  from public.technical_prod_batches
  where id = p_prod_batch_id
    and company_id = p_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'PROD não encontrado.';
  end if;

  if v_prod.status in ('entregue_suprimentos', 'entregue_producao', 'concluido', 'cancelado') then
    raise exception 'Esta PROD não pode receber uma nova revisão de fabricação no estado atual.';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_recorded_by_profile_id
      and profile.company_id = p_company_id
      and profile.status = 'active'
  ) then
    raise exception 'Usuário responsável pelo registro não encontrado.';
  end if;

  select count(*)
  into v_piece_count
  from public.technical_prod_batch_pieces link
  where link.prod_batch_id = p_prod_batch_id;

  select count(*)
  into v_measurement_count
  from (
    select distinct (item->>'piece_id')::uuid as piece_id
    from jsonb_array_elements(p_measurements) item
    where item ? 'piece_id'
      and item ? 'manufacturing_width_mm'
      and item ? 'manufacturing_height_mm'
      and (item->>'manufacturing_width_mm')::numeric > 0
      and (item->>'manufacturing_height_mm')::numeric > 0
  ) parsed
  where exists (
    select 1
    from public.technical_prod_batch_pieces link
    where link.prod_batch_id = p_prod_batch_id
      and link.piece_id = parsed.piece_id
  );

  if v_piece_count = 0 or v_measurement_count <> v_piece_count
     or jsonb_array_length(p_measurements) <> v_piece_count then
    raise exception 'Informe largura e altura de fabricação para todas as peças desta PROD.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_measurements) item
    where not exists (
      select 1
      from public.technical_prod_batch_pieces link
      where link.prod_batch_id = p_prod_batch_id
        and link.piece_id = (item->>'piece_id')::uuid
    )
  ) then
    raise exception 'Foi informada uma peça que não pertence a esta PROD.';
  end if;

  v_next_revision := v_prod.current_revision + 1;

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
    p_company_id,
    v_prod.contract_id,
    p_prod_batch_id,
    (item->>'piece_id')::uuid,
    v_next_revision,
    (item->>'manufacturing_width_mm')::numeric,
    (item->>'manufacturing_height_mm')::numeric,
    btrim(p_change_reason),
    p_recorded_by_profile_id
  from jsonb_array_elements(p_measurements) item;

  update public.technical_prod_batches
  set current_revision = v_next_revision,
      cem_registered = true,
      cem_checked = false,
      status = 'aguardando_conferencia',
      checked_by_profile_id = null,
      checked_at = null,
      approved_by_profile_id = null,
      approved_at = null,
      approved_snapshot = null,
      updated_at = now()
  where id = p_prod_batch_id
    and company_id = p_company_id;

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
    p_company_id,
    'technical_prod_batches',
    v_prod.contract_id,
    'prod_manufacturing_measurements_revision',
    p_auth_user_id,
    jsonb_build_object(
      'prod_batch_id', p_prod_batch_id,
      'batch_number', v_prod.batch_number,
      'revision', v_prod.current_revision,
      'status', v_prod.status
    ),
    jsonb_build_object(
      'prod_batch_id', p_prod_batch_id,
      'batch_number', v_prod.batch_number,
      'revision', v_next_revision,
      'status', 'aguardando_conferencia',
      'measurements', p_measurements,
      'recorded_by_profile_id', p_recorded_by_profile_id
    ),
    'Revisão das medidas efetivas de fabricação/CEM registrada. Motivo: ' || btrim(p_change_reason)
  );

  return v_next_revision;
end;
$$;

revoke all on function public.save_prod_manufacturing_measurement_revision(uuid, uuid, uuid, uuid, text, jsonb) from public;
revoke all on function public.save_prod_manufacturing_measurement_revision(uuid, uuid, uuid, uuid, text, jsonb) from anon;
revoke all on function public.save_prod_manufacturing_measurement_revision(uuid, uuid, uuid, uuid, text, jsonb) from authenticated;
grant execute on function public.save_prod_manufacturing_measurement_revision(uuid, uuid, uuid, uuid, text, jsonb) to service_role;
