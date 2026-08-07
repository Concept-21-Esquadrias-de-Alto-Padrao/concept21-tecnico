create or replace function public.technical_validate_visit_ready(target_contract_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  technical_record public.technical_contracts%rowtype;
begin
  select *
    into technical_record
  from public.technical_contracts
  where contract_id = target_contract_id;

  if technical_record.contract_id is null then
    raise exception 'Contrato técnico não encontrado.';
  end if;

  if not technical_record.commercial_folder_received then
    raise exception 'Contrato sem pasta comercial entregue não avança para visita inicial.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'entrada_comercial') then
    raise exception 'Entrada comercial aguarda ciência de todos os participantes.';
  end if;

  if not exists (
    select 1
    from public.technical_closing_meetings meeting
    where meeting.contract_id = target_contract_id
      and meeting.status = 'concluida'
  ) then
    raise exception 'Contrato sem reunião de fechamento não avança para visita inicial.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'reuniao_ata') then
    raise exception 'Reunião e ata aguardam ciência de todos os participantes.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'acoes') then
    raise exception 'Ações da etapa inicial aguardam ciência de todos os participantes.';
  end if;

  if exists (
    select 1
    from public.technical_actions action
    where action.contract_id = target_contract_id
      and action.blocking
      and coalesce(action.blocking_stage, 'entrada_inicial') = 'entrada_inicial'
      and action.status not in ('concluida', 'cancelada')
      and action.deleted_at is null
  ) then
    raise exception 'Ação bloqueante da etapa inicial impede a visita.';
  end if;

  return true;
end;
$$;
