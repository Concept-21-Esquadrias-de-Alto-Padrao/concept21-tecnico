begin;

alter table public.technical_actions
  add column if not exists piece_id uuid references public.technical_contract_pieces(id) on delete set null,
  add column if not exists action_type text not null default 'geral',
  add column if not exists financial_impact text not null default 'a_avaliar',
  add column if not exists financial_amount numeric(14, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'technical_actions_action_type_check'
      and conrelid = 'public.technical_actions'::regclass
  ) then
    alter table public.technical_actions
      add constraint technical_actions_action_type_check
      check (action_type in ('geral', 'alteracao_estrutural'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'technical_actions_financial_impact_check'
      and conrelid = 'public.technical_actions'::regclass
  ) then
    alter table public.technical_actions
      add constraint technical_actions_financial_impact_check
      check (financial_impact in ('a_avaliar', 'sem_impacto', 'credito', 'cobranca_adicional'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'technical_actions_financial_amount_check'
      and conrelid = 'public.technical_actions'::regclass
  ) then
    alter table public.technical_actions
      add constraint technical_actions_financial_amount_check
      check (financial_amount is null or financial_amount >= 0);
  end if;
end
$$;

create index if not exists technical_actions_piece_open_idx
  on public.technical_actions (company_id, piece_id, status)
  where piece_id is not null and deleted_at is null;

comment on column public.technical_actions.piece_id is
  'Peça afetada quando a ação representa uma alteração estrutural identificada em campo.';
comment on column public.technical_actions.financial_impact is
  'Possível efeito comercial da alteração: a avaliar, sem impacto, crédito ou cobrança adicional.';

commit;
