revoke all on table public.technical_prod_piece_manufacturing_measurements from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.technical_prod_piece_manufacturing_measurements
  from authenticated;

grant select on table public.technical_prod_piece_manufacturing_measurements to authenticated;
