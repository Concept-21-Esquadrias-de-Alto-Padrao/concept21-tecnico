-- Contract viewers need the complete read model used by the contract detail page.
-- Write access remains governed by the existing manage/check/approve policies.

drop policy if exists technical_prods_read
on public.technical_prod_batches;

create policy technical_prods_read
on public.technical_prod_batches
for select to authenticated
using (
  company_id = public.current_company_id()
  and public.has_any_permission(array[
    'technical.contracts.view',
    'technical.prods.view'
  ])
);

drop policy if exists technical_prod_batch_pieces_read
on public.technical_prod_batch_pieces;

create policy technical_prod_batch_pieces_read
on public.technical_prod_batch_pieces
for select to authenticated
using (
  exists (
    select 1
    from public.technical_prod_batches prod
    where prod.id = prod_batch_id
      and prod.company_id = public.current_company_id()
      and public.has_any_permission(array[
        'technical.contracts.view',
        'technical.prods.view'
      ])
  )
);

drop policy if exists technical_prod_manufacturing_measurements_read
on public.technical_prod_piece_manufacturing_measurements;

create policy technical_prod_manufacturing_measurements_read
on public.technical_prod_piece_manufacturing_measurements
for select to authenticated
using (
  company_id = public.current_company_id()
  and public.has_any_permission(array[
    'technical.contracts.view',
    'technical.prods.view'
  ])
);

grant select on table public.technical_prod_batches to authenticated;
grant select on table public.technical_prod_batch_pieces to authenticated;
grant select on table public.technical_prod_piece_manufacturing_measurements to authenticated;
