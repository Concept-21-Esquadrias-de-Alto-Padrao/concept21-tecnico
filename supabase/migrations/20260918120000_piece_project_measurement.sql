alter table public.technical_contract_pieces
  add column if not exists project_only boolean not null default false;

alter table public.technical_contract_pieces
  add constraint technical_contract_pieces_project_without_measurements_check
  check (not project_only or (measured_width_mm is null and measured_height_mm is null));

alter table public.technical_release_pieces
  add column if not exists project_only_at_release boolean not null default false;
