begin;
create table public.technical_fabrication_item_sources (
 item_id uuid not null references public.technical_fabrication_items(id),
 piece_id uuid not null references public.technical_contract_pieces(id),
 primary key(item_id,piece_id)
);
create index on public.technical_fabrication_item_sources(piece_id);
alter table public.technical_fabrication_item_sources enable row level security;
revoke all on public.technical_fabrication_item_sources from public,anon,authenticated;
grant all on public.technical_fabrication_item_sources to service_role;
create function public.technical_validate_fabrication_links() returns trigger language plpgsql set search_path=public as $$
declare l jsonb;
begin
 if jsonb_typeof(new.draft->'links') is distinct from 'array' then raise exception 'Informe a origem dos recortes.'; end if;
 if jsonb_array_length(new.draft->'links')<>jsonb_array_length(new.draft->'fabricationCodes') or
 (select count(distinct value->>'fabricationCode') from jsonb_array_elements(new.draft->'links'))<>jsonb_array_length(new.draft->'fabricationCodes') then raise exception 'Recortes duplicados ou sem origem.'; end if;
 for l in select value from jsonb_array_elements(new.draft->'links') loop
 if not coalesce((new.draft->'fabricationCodes') ? (l->>'fabricationCode'),false) or not coalesce((new.draft->'contractCodes') ? (l->>'contractCode'),false) then raise exception 'Origem fora do conjunto.'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(new.draft->'contractCodes') c where not exists(select 1 from jsonb_array_elements(new.draft->'links') item where item.value->>'contractCode'=c.value)) then raise exception 'Item contratado sem recorte associado.'; end if;
 return new;
end $$;
create trigger fabrication_links_validate before insert or update of draft on public.technical_fabrication_sets for each row execute function public.technical_validate_fabrication_links();
create function public.technical_attach_fabrication_links() returns trigger language plpgsql set search_path=public as $$
declare s technical_fabrication_sets%rowtype;
begin
 if tg_table_name='technical_prod_batches' then
  if not coalesce(new.cem_report ? 'fabricationSetId',false) then return new; end if;
  select * into strict s from technical_fabrication_sets where id=(new.cem_report->>'fabricationSetId')::uuid and company_id=new.company_id and contract_id=new.contract_id;
  new.cem_report:=new.cem_report||jsonb_build_object('originLinks',s.draft->'links');
  new.description:='Conjunto de fabricação · vínculos aprovados e medidas preservadas';
 else
  select * into strict s from technical_fabrication_sets where id=new.set_id;
  new.report:=new.report||jsonb_build_object('originLinks',s.draft->'links');
 end if;
 return new;
end $$;
create trigger fabrication_report_links before insert on public.technical_prod_batches for each row execute function public.technical_attach_fabrication_links();
create trigger fabrication_import_links before insert on public.technical_fabrication_imports for each row execute function public.technical_attach_fabrication_links();
create function public.technical_link_fabrication_item() returns trigger language plpgsql set search_path=public as $$
declare s technical_fabrication_sets%rowtype; pid uuid; source_code text;
begin
 if new.piece_id is not null then
 insert into technical_fabrication_item_sources values(new.id,new.piece_id);
 else
 select * into strict s from technical_fabrication_sets where id=new.set_id;
 select value->>'contractCode' into strict source_code from jsonb_array_elements(s.draft->'links') where value->>'fabricationCode'=new.code;
 select p.id into strict pid from technical_contract_pieces p join technical_fabrication_set_sources x on x.piece_id=p.id and x.set_id=s.id where p.company_id=s.company_id and p.contract_id=s.contract_id and p.code=source_code and p.deleted_at is null;
 insert into technical_fabrication_item_sources values(new.id,pid);
 end if;
 return new;
end $$;
create trigger fabrication_item_links after insert on public.technical_fabrication_items for each row execute function public.technical_link_fabrication_item();
revoke all on function public.technical_validate_fabrication_links(),public.technical_attach_fabrication_links(),public.technical_link_fabrication_item() from public,anon,authenticated;
commit;

