begin;
create table if not exists public.technical_piece_external_services (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id), contract_id uuid not null references production_contracts(id), piece_id uuid not null references technical_contract_pieces(id),
 name text not null check(name in ('Estrutura metálica','Automação')), status text not null default 'a_confirmar' check(status in ('a_confirmar','a_contratar','contratado','em_execucao','concluido')),
 owner_name text, supplier text, due_date date, notes text, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(piece_id,name));
alter table public.technical_piece_external_services enable row level security;
revoke all on public.technical_piece_external_services from anon,authenticated;
grant all on public.technical_piece_external_services to service_role;
create or replace function public.technical_save_external_service(co uuid,cid uuid,sid uuid,actor uuid,expected_version integer,changes jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare s technical_piece_external_services%rowtype; n technical_piece_external_services%rowtype;
begin
 select * into strict s from technical_piece_external_services where id=sid and company_id=co and contract_id=cid for update;
 if s.version<>expected_version then raise exception 'Registro atualizado por outra pessoa. Recarregue antes de salvar.'; end if;
 if coalesce(changes->>'status','') not in ('a_confirmar','a_contratar','contratado','em_execucao','concluido') then raise exception 'Situação inválida'; end if;
 if changes->>'status'<>'a_confirmar' and (nullif(trim(changes->>'owner_name'),'') is null or nullif(changes->>'due_date','') is null) then raise exception 'Informe responsável interno e prazo'; end if;
 if changes->>'status' in ('contratado','em_execucao','concluido') and nullif(trim(changes->>'supplier'),'') is null then raise exception 'Informe o prestador';end if;
 update technical_piece_external_services set status=changes->>'status',owner_name=nullif(trim(changes->>'owner_name'),''),supplier=nullif(trim(changes->>'supplier'),''),due_date=nullif(changes->>'due_date','')::date,notes=nullif(trim(changes->>'notes'),''),version=version+1,updated_at=now() where id=sid returning * into n;
 insert into audit_logs(company_id,entity,entity_id,action,user_id,before_data,after_data,notes) values(co,'technical_piece_external_services',sid,'external_service_updated',actor,to_jsonb(s),to_jsonb(n),'Acompanhamento independente da fabricação interna. Não altera contrato, medidas, PROD ou repasses.');
 return to_jsonb(n);
end $$;
revoke all on function public.technical_save_external_service(uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.technical_save_external_service(uuid,uuid,uuid,uuid,integer,jsonb) to service_role;
commit;
