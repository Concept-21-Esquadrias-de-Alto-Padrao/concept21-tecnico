alter table public.technical_releases
  add column if not exists batch_number text,
  add column if not exists validation_required boolean not null default false,
  add column if not exists status text not null default 'validado',
  add column if not exists validated_at timestamptz;

alter table public.technical_releases
  drop constraint if exists technical_releases_status_check;

alter table public.technical_releases
  add constraint technical_releases_status_check
  check (status in ('aguardando_assinatura', 'validado', 'cancelado'));

update public.technical_releases
set status = 'validado',
    validated_at = coalesce(validated_at, created_at)
where validation_required = false
  and status = 'aguardando_assinatura';

with existing_released_pieces as (
  select
    piece.company_id,
    piece.contract_id,
    min(coalesce(piece.released_at, piece.created_at))::date as first_release_date
  from public.technical_contract_pieces piece
  where piece.deleted_at is null
    and piece.status in ('liberada', 'em_prod', 'entregue')
    and not exists (
      select 1
      from public.technical_release_pieces link
      where link.piece_id = piece.id
    )
  group by piece.company_id, piece.contract_id
),
inserted_releases as (
  insert into public.technical_releases (
    company_id,
    contract_id,
    batch_number,
    release_date,
    validation_required,
    status,
    validated_at,
    notes
  )
  select
    company_id,
    contract_id,
    'Liberação anterior',
    coalesce(first_release_date, current_date),
    false,
    'validado',
    now(),
    'Lote criado automaticamente para preservar liberações anteriores.'
  from existing_released_pieces
  returning id, company_id, contract_id
)
insert into public.technical_release_pieces (release_id, piece_id, due_date)
select
  inserted_releases.id,
  piece.id,
  piece.release_due_date
from inserted_releases
join public.technical_contract_pieces piece
  on piece.company_id = inserted_releases.company_id
 and piece.contract_id = inserted_releases.contract_id
where piece.deleted_at is null
  and piece.status in ('liberada', 'em_prod', 'entregue')
  and not exists (
    select 1
    from public.technical_release_pieces link
    where link.piece_id = piece.id
  );

create table if not exists public.technical_release_participants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  release_id uuid not null references public.technical_releases(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  signed_at timestamptz,
  signed_by_auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(release_id, profile_id)
);

create index if not exists technical_releases_contract_status_idx
  on public.technical_releases(company_id, contract_id, status, created_at desc);

create index if not exists technical_release_pieces_piece_idx
  on public.technical_release_pieces(piece_id, release_id);

create index if not exists technical_release_participants_release_idx
  on public.technical_release_participants(release_id, signed_at);

drop policy if exists technical_release_pieces_manage on public.technical_release_pieces;
drop policy if exists technical_release_pieces_read on public.technical_release_pieces;
create policy technical_release_pieces_read on public.technical_release_pieces
for select to authenticated
using (
  exists (
    select 1
    from public.technical_releases technical_release
    where technical_release.id = technical_release_pieces.release_id
      and technical_release.company_id = public.current_company_id()
      and public.has_any_permission(array[
        'technical.contracts.view',
        'technical.pieces.release',
        'technical.prods.view',
        'technical.prods.manage'
      ])
  )
);

drop policy if exists technical_release_pieces_write on public.technical_release_pieces;
create policy technical_release_pieces_write on public.technical_release_pieces
for all to authenticated
using (
  exists (
    select 1
    from public.technical_releases technical_release
    where technical_release.id = technical_release_pieces.release_id
      and technical_release.company_id = public.current_company_id()
      and public.has_permission('technical.pieces.release')
  )
)
with check (
  exists (
    select 1
    from public.technical_releases technical_release
    where technical_release.id = technical_release_pieces.release_id
      and technical_release.company_id = public.current_company_id()
      and public.has_permission('technical.pieces.release')
  )
);

drop trigger if exists technical_release_participants_touch_updated_at
on public.technical_release_participants;

create trigger technical_release_participants_touch_updated_at
before update on public.technical_release_participants
for each row execute function public.touch_updated_at();

alter table public.technical_release_participants enable row level security;

drop policy if exists technical_release_participants_read on public.technical_release_participants;
create policy technical_release_participants_read on public.technical_release_participants
for select to authenticated
using (
  company_id = public.current_company_id()
  and public.has_any_permission(array[
    'technical.contracts.view',
    'technical.pieces.release',
    'technical.prods.view',
    'technical.prods.manage'
  ])
);

drop policy if exists technical_release_participants_manage on public.technical_release_participants;
drop policy if exists technical_release_participants_write on public.technical_release_participants;
create policy technical_release_participants_write on public.technical_release_participants
for all to authenticated
using (
  company_id = public.current_company_id()
  and public.has_permission('technical.pieces.release')
)
with check (
  company_id = public.current_company_id()
  and public.has_permission('technical.pieces.release')
);
