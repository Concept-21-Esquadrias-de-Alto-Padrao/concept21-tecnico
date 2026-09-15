begin;

alter table public.technical_contracts
  alter column technical_status set default 'aguardando_reuniao';

-- Only pending initial stages change position. Existing business records stay intact.
with initial_status as (
  select technical.contract_id,
    case
      when not exists (
        select 1 from public.technical_closing_meetings meeting
        where meeting.company_id = technical.company_id
          and meeting.contract_id = technical.contract_id
          and meeting.status = 'concluida'
      ) then 'aguardando_reuniao'
      when not technical.commercial_folder_received then 'aguardando_pasta'
      else 'em_acompanhamento'
    end as next_status
  from public.technical_contracts technical
  join public.production_contracts contract
    on contract.id = technical.contract_id and contract.company_id = technical.company_id
  where technical.technical_status in ('aguardando_pasta', 'aguardando_reuniao')
    and technical.deleted_at is null
    and contract.active
)
update public.technical_contracts technical
set technical_status = initial_status.next_status
from initial_status
where technical.contract_id = initial_status.contract_id
  and technical.technical_status is distinct from initial_status.next_status;

create or replace function public.technical_validate_visit_ready(target_contract_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  technical_record public.technical_contracts%rowtype;
begin
  select * into technical_record
  from public.technical_contracts
  where contract_id = target_contract_id;

  if technical_record.contract_id is null then
    raise exception 'Contrato técnico não encontrado.';
  end if;

  if not exists (
    select 1 from public.technical_closing_meetings meeting
    where meeting.company_id = technical_record.company_id
      and meeting.contract_id = target_contract_id
      and meeting.status = 'concluida'
  ) then
    raise exception 'Registre a reunião de fechamento antes de agendar a visita.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'reuniao_ata') then
    raise exception 'Reunião e ata aguardam ciência de todos os participantes.';
  end if;

  if not technical_record.commercial_folder_received then
    raise exception 'Registre a entrega da pasta comercial antes de agendar a visita.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'entrada_comercial') then
    raise exception 'Entrega da pasta aguarda ciência de todos os participantes.';
  end if;

  if not public.technical_stage_validation_satisfied(target_contract_id, 'acoes') then
    raise exception 'Ações da etapa inicial aguardam ciência de todos os participantes.';
  end if;

  if exists (
    select 1 from public.technical_actions action
    where action.company_id = technical_record.company_id
      and action.contract_id = target_contract_id
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

commit;
