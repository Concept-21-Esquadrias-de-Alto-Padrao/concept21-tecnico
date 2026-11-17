-- Preserve the exact existing company and permission predicates, evaluated once per statement.
alter policy technical_pieces_read on public.technical_contract_pieces
using ((company_id = (select public.current_company_id())) and
(select public.has_any_permission(array['technical.contracts.view','technical.prods.view','technical.visits.view']::text[])));
