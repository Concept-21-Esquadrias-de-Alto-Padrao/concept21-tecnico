begin;
alter table public.technical_contract_pieces add column if not exists complements_piece_id uuid references public.technical_contract_pieces(id);
alter table public.technical_contract_pieces add column if not exists fulfilled_by_addendum_piece_id uuid references public.technical_contract_pieces(id);
create unique index if not exists technical_unique_complement on public.technical_contract_pieces(complements_piece_id) where complements_piece_id is not null;
create unique index if not exists technical_unique_addendum_fulfillment on public.technical_contract_pieces(fulfilled_by_addendum_piece_id) where fulfilled_by_addendum_piece_id is not null;
create or replace function public.technical_link_addendum(co uuid,actor uuid,principal uuid,aditivo uuid,pairs jsonb,reason text)
returns jsonb language plpgsql set search_path=public as $$
declare pair jsonb; base technical_contract_pieces%rowtype; extra technical_contract_pieces%rowtype; prod technical_prod_batches%rowtype; oldbase jsonb; oldextra jsonb; total integer:=0;
begin
 if principal=aditivo or nullif(trim(reason),'') is null or jsonb_typeof(pairs) is distinct from 'array' or jsonb_array_length(pairs) not between 1 and 100 then raise exception 'Confira os contratos, peças e motivo.';end if;
 if not exists(select 1 from profiles pr where pr.user_id=actor and pr.company_id=co and pr.status='active' and (pr.is_master or exists(select 1 from user_roles ur join roles rr on rr.id=ur.role_id where ur.profile_id=pr.id and ur.company_id=co and ur.active and rr.active and (rr.is_master_role or exists(select 1 from role_permissions rp join permissions pe on pe.id=rp.permission_id where rp.role_id=rr.id and rp.company_id=co and pe.key='technical.prods.manage'))))) then raise exception 'Sem permissão para vincular aditivos.';end if;
 perform id from production_contracts where id in (principal,aditivo) and company_id=co and active order by id for update;
 if (select count(*) from production_contracts where id in (principal,aditivo) and company_id=co and active)<>2 then raise exception 'Contratos indisponíveis.';end if;
 if exists(select 1 from technical_contracts where contract_id in (principal,aditivo) and deleted_at is not null) then raise exception 'Contrato excluído.';end if;
 if jsonb_array_length(pairs)<>(select count(distinct value->>'base') from jsonb_array_elements(pairs)) or jsonb_array_length(pairs)<>(select count(distinct value->>'extra') from jsonb_array_elements(pairs)) then raise exception 'Uma peça não pode ser vinculada duas vezes.';end if;
 for pair in select value from jsonb_array_elements(pairs) loop
  select * into strict base from technical_contract_pieces where id=(pair->>'base')::uuid and contract_id=principal and company_id=co and deleted_at is null for update;
  select * into strict extra from technical_contract_pieces where id=(pair->>'extra')::uuid and contract_id=aditivo and company_id=co and deleted_at is null for update;
  if base.fulfilled_by_addendum_piece_id=extra.id and extra.complements_piece_id=base.id then continue;end if;
  if base.complements_piece_id is not null or base.fulfilled_by_addendum_piece_id is not null or extra.complements_piece_id is not null or extra.fulfilled_by_addendum_piece_id is not null or base.quantity<>extra.quantity or base.status not in ('liberada','medida','avaliada','aguardando_avaliacao') or extra.status not in ('em_prod','entregue') then raise exception 'Confira quantidade, situação ou vínculo existente: %.',base.code;end if;
  if base.active_prod_batch_id is not null or exists(select 1 from technical_prod_batch_pieces l join technical_prod_batches b on b.id=l.prod_batch_id where l.piece_id=base.id and b.deleted_at is null and b.status<>'cancelado') then raise exception 'A peça principal já possui PROD.';end if;
  select * into strict prod from technical_prod_batches where id=extra.active_prod_batch_id and contract_id=aditivo and company_id=co and deleted_at is null and status='aprovado';
  if not exists(select 1 from technical_prod_batch_pieces where prod_batch_id=prod.id and piece_id=extra.id) then raise exception 'PROD sem vínculo com o complemento.';end if;
  if technical_alignment_has_block(co,principal,'prods',base.id) or exists(select 1 from technical_corrections where piece_id=base.id and deleted_at is null and blocking and status not in ('encerrada','cancelada')) then raise exception 'Peça principal possui pendência bloqueante.';end if;
  oldbase:=to_jsonb(base);oldextra:=to_jsonb(extra);
  update technical_contract_pieces set complements_piece_id=base.id where id=extra.id;
  update technical_contract_pieces set fulfilled_by_addendum_piece_id=extra.id,active_prod_batch_id=prod.id,status=extra.status,cem_registered=extra.cem_registered,cem_checked=extra.cem_checked where id=base.id;
  insert into audit_logs(company_id,entity,entity_id,action,user_id,before_data,after_data,notes) values(co,'technical_contract_pieces',base.id,'addendum_fulfillment_linked',actor,jsonb_build_object('principal',oldbase,'aditivo',oldextra),jsonb_build_object('principalPiece',base.id,'addendumPiece',extra.id,'prod',prod.id,'physicalUnits',base.quantity,'installation','nao_alterada'),reason);
  total:=total+base.quantity;
 end loop;
 return jsonb_build_object('linkedUnits',total,'duplicateProduction',false);
end $$;
revoke all on function public.technical_link_addendum(uuid,uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.technical_link_addendum(uuid,uuid,uuid,uuid,jsonb,text) to service_role;
-- Existing associations require explicit review before cancellation or reassignment.
create or replace function public.technical_guard_addendum_piece() returns trigger language plpgsql set search_path=public as $$
begin
 if old.complements_piece_id is not null or old.fulfilled_by_addendum_piece_id is not null then
  if new.deleted_at is distinct from old.deleted_at or new.quantity<>old.quantity or new.contract_id<>old.contract_id or new.company_id<>old.company_id or new.active_prod_batch_id is distinct from old.active_prod_batch_id or new.status='cancelada' or new.complements_piece_id is distinct from old.complements_piece_id or new.fulfilled_by_addendum_piece_id is distinct from old.fulfilled_by_addendum_piece_id then raise exception 'Esta peça possui vínculo com aditivo. Revise o vínculo antes de alterar o escopo.';end if;
 end if;
 return new;
end $$;
drop trigger if exists technical_guard_addendum_piece on public.technical_contract_pieces;
create trigger technical_guard_addendum_piece before update on public.technical_contract_pieces for each row execute function public.technical_guard_addendum_piece();
commit;
