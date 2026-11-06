begin;
alter table public.technical_releases add column if not exists folder_handoff jsonb;
create or replace function public.protect_release_folder_handoff() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user not in ('postgres','service_role','supabase_admin') then
  if TG_OP='INSERT' then
   if new.folder_handoff is not null then raise exception 'Repasse da pasta somente pela ação autorizada.'; end if;
  elsif new.folder_handoff is distinct from old.folder_handoff then raise exception 'Repasse da pasta somente pela ação autorizada.'; end if;
 end if;
 return new;
end $$;
drop trigger if exists protect_release_folder_handoff on public.technical_releases;
create trigger protect_release_folder_handoff before insert or update on public.technical_releases for each row execute function public.protect_release_folder_handoff();
create or replace function public.technical_release_folder_step(co uuid, rid uuid, actor uuid, step text, effective date, recipient uuid default null)
returns void language plpgsql set search_path=public as $$
declare r public.technical_releases; h jsonb; n jsonb;
begin
 select * into r from public.technical_releases where id=rid and company_id=co for update;
 if not found or r.status='cancelado' then raise exception 'Lote indisponível.'; end if;
 if not exists(select 1 from public.profiles where id=actor and company_id=co and status='active') then raise exception 'Responsável inválido.'; end if;
 if effective is null or effective > (now() at time zone 'America/Sao_Paulo')::date or effective < r.release_date::date then raise exception 'Informe uma data efetiva entre a liberação e hoje.'; end if;
 h:=coalesce(r.folder_handoff,'{}'::jsonb);
 if step='send' then
  if h ? 'sent_date' then raise exception 'O envio já foi registrado. Atualize a página.'; end if;
  if not exists(select 1 from public.profiles where id=recipient and company_id=co and status='active') then raise exception 'Selecione o responsável que receberá a pasta.'; end if;
  n:=jsonb_build_object('sent_date',effective,'sent_by',actor,'sent_recorded_at',now(),'recipient',recipient);
 elsif step='receive' then
  if not (h ? 'sent_date') then raise exception 'Registre o envio da pasta primeiro.'; end if;
  if h ? 'received_date' then raise exception 'O recebimento já foi registrado. O prazo não será reiniciado.'; end if;
  if actor::text <> h->>'recipient' then raise exception 'Somente o destinatário indicado pode confirmar o recebimento.'; end if;
  if effective < (h->>'sent_date')::date then raise exception 'Recebimento não pode ser anterior ao envio.'; end if;
  n:=h||jsonb_build_object('received_date',effective,'received_by',actor,'received_recorded_at',now());
 else raise exception 'Operação inválida.'; end if;
 update public.technical_releases set folder_handoff=n where id=rid;
 insert into public.audit_logs(company_id,entity,entity_id,action,user_id,before_data,after_data,notes)
 values(co,'technical_releases',rid,'folder_'||step,actor,h,n,case when step='send' then 'Pasta encaminhada para emissão de PROD.' else 'Pasta recebida. Início do prazo de cinco dias úteis para emissão.' end);
end $$;
revoke all on function public.technical_release_folder_step(uuid,uuid,uuid,text,date,uuid) from public,anon,authenticated;
grant execute on function public.technical_release_folder_step(uuid,uuid,uuid,text,date,uuid) to service_role;
commit;
