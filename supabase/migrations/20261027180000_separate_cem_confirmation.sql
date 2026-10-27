-- CEM confirmation belongs to technical checking, not PROD data entry.
-- Do not change any existing role grants or existing piece data.
create or replace function public.guard_piece_cem_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cem_changed boolean;
begin
  if TG_OP = 'INSERT' then
    cem_changed := coalesce(NEW.cem_registered, false) or coalesce(NEW.cem_checked, false);
  else
    cem_changed := NEW.cem_registered is distinct from OLD.cem_registered
      or NEW.cem_checked is distinct from OLD.cem_checked;
  end if;
  if cem_changed
    and (current_user in ('authenticated', 'anon') or auth.role() in ('authenticated', 'anon'))
    and not coalesce(public.has_permission('technical.prods.check'), false) then
    raise exception 'Somente o responsável pela conferência técnica pode atualizar o CEM.'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists guard_piece_cem_confirmation on public.technical_contract_pieces;
create trigger guard_piece_cem_confirmation
before insert or update on public.technical_contract_pieces
for each row execute function public.guard_piece_cem_confirmation();

-- Server actions use the service role and must enforce technical.prods.check.
-- Rollback: drop trigger guard_piece_cem_confirmation on public.technical_contract_pieces;
--           drop function public.guard_piece_cem_confirmation();
