-- Permite relançar um contrato com o mesmo número após exclusão lógica.
alter table public.production_contracts
  drop constraint if exists production_contracts_company_id_contract_number_key;

create unique index if not exists production_contracts_company_active_contract_number_idx
  on public.production_contracts(company_id, contract_number)
  where active;
