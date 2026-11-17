begin;
create table public.technical_fabrication_sets (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id),
 contract_id uuid not null references production_contracts(id), name text not null,
 draft jsonb not null, version integer not null default 1,
 created_by uuid not null, created_at timestamptz not null default now(),
 updated_by uuid not null, updated_at timestamptz not null default now(),
 unique(company_id,contract_id,name)
);
create table public.technical_fabrication_set_sources (
 set_id uuid not null references technical_fabrication_sets(id), piece_id uuid not null references technical_contract_pieces(id),
 primary key(set_id,piece_id)
);
create table public.technical_fabrication_imports (
 id uuid primary key default gen_random_uuid(), set_id uuid not null references technical_fabrication_sets(id),
 prod_batch_id uuid not null unique references technical_prod_batches(id),
 digest text not null check(length(digest)=64), report jsonb not null,
 created_by uuid not null, created_at timestamptz not null default now(),
 unique(set_id,digest)
);
create table public.technical_fabrication_items (
 id uuid primary key default gen_random_uuid(), import_id uuid not null references technical_fabrication_imports(id),
 set_id uuid references technical_fabrication_sets(id), piece_id uuid references technical_contract_pieces(id),
 code text not null, environment text, quantity integer not null check(quantity>0),
 width_mm numeric not null check(width_mm>0), height_mm numeric not null check(height_mm>0),
 area_m2 numeric not null check(area_m2>=0), weight_kg numeric not null check(weight_kg>=0),
 check((set_id is null) <> (piece_id is null)), unique(import_id,code)
);
create index on technical_fabrication_sets(contract_id);
create index on technical_fabrication_set_sources(piece_id);
create index on technical_fabrication_imports(set_id);
create index on technical_fabrication_items(set_id);
create index on technical_fabrication_items(piece_id);
alter table technical_fabrication_sets enable row level security;
alter table technical_fabrication_set_sources enable row level security;
alter table technical_fabrication_imports enable row level security;
alter table technical_fabrication_items enable row level security;
revoke all on technical_fabrication_sets,technical_fabrication_set_sources,technical_fabrication_imports,technical_fabrication_items from anon,authenticated;
grant all on technical_fabrication_sets,technical_fabrication_set_sources,technical_fabrication_imports,technical_fabrication_items to service_role;

create function technical_save_fabrication_set(co uuid,cid uuid,actor uuid,p_draft jsonb,p_version integer)
returns jsonb language plpgsql set search_path=public as $$
declare s technical_fabrication_sets%rowtype; c text; pid uuid;
begin
 perform 1 from production_contracts where id=cid and company_id=co and active for update;
 if not found then raise exception 'Contrato indisponível.'; end if;
 if nullif(trim(p_draft->>'name'),'') is null
 or jsonb_typeof(p_draft->'contractCodes') is distinct from 'array'
 or jsonb_typeof(p_draft->'fabricationCodes') is distinct from 'array'
 or jsonb_array_length(p_draft->'contractCodes')=0 or jsonb_array_length(p_draft->'fabricationCodes')=0
 or coalesce(p_draft->>'coverage','invalid') not in ('','partial','total')
 or (p_draft->>'coverage'='partial' and nullif(trim(p_draft->>'pending'),'') is null)
 then raise exception 'Confira os itens e o detalhamento do conjunto.'; end if;
 if (select count(distinct value) from jsonb_array_elements_text(p_draft->'contractCodes'))<>jsonb_array_length(p_draft->'contractCodes')
 or (select count(distinct value) from jsonb_array_elements_text(p_draft->'fabricationCodes'))<>jsonb_array_length(p_draft->'fabricationCodes')
 then raise exception 'Itens duplicados.'; end if;
 select * into s from technical_fabrication_sets where company_id=co and contract_id=cid for update;
 if found then
  if s.version<>p_version then raise exception 'O conjunto foi alterado. Recarregue antes de salvar.'; end if;
  if s.draft=p_draft then return to_jsonb(s); end if;
  if exists(select 1 from technical_fabrication_imports where set_id=s.id) then raise exception 'Conjunto importado: alterações exigem revisão; este ensaio mantém a versão original.'; end if;
  update technical_fabrication_sets set name=p_draft->>'name',draft=p_draft,version=version+1,updated_by=actor,updated_at=now() where id=s.id returning * into s;
  delete from technical_fabrication_set_sources where set_id=s.id;
 else
  if p_version<>0 then raise exception 'Versão divergente.'; end if;
  insert into technical_fabrication_sets(company_id,contract_id,name,draft,created_by,updated_by)
   values(co,cid,p_draft->>'name',p_draft,actor,actor) returning * into s;
 end if;
 for c in select value from jsonb_array_elements_text(p_draft->'contractCodes') loop
  select id into pid from technical_contract_pieces where company_id=co and contract_id=cid and code=c and deleted_at is null and status<>'cancelada' for update;
  if not found or c in ('P01','P11') then raise exception 'Origem inválida ou peça individual incluída no conjunto.';end if;
  insert into technical_fabrication_set_sources values(s.id,pid);
 end loop;
 insert into audit_logs(company_id,entity,entity_id,action,user_id,after_data,notes)
 values(co,'technical_fabrication_sets',s.id,'fabrication_set_saved',actor,to_jsonb(s),'Conjunto de fabricação salvo; medidas de campo e venda preservadas.');
 return to_jsonb(s);
end $$;

create function technical_import_fabrication_set(co uuid,cid uuid,actor uuid,sid uuid,p_version integer,num text,report jsonb)
returns jsonb language plpgsql set search_path=public as $$
#variable_conflict use_variable
declare s technical_fabrication_sets%rowtype; b technical_prod_batches%rowtype; imp technical_fabrication_imports%rowtype; rowdata jsonb; pid uuid; grouped boolean; allcodes text[];
begin
 perform 1 from production_contracts where id=cid and company_id=co and active for update;
 if not found then raise exception 'Contrato indisponível.'; end if;
 select * into s from technical_fabrication_sets where id=sid and company_id=co and contract_id=cid for update;
 if not found or s.version<>p_version then raise exception 'Conjunto alterado. Refaça a conferência.';end if;
 if report->>'digest' !~ '^[a-f0-9]{64}$' or nullif(trim(num),'') is null or jsonb_typeof(report->'rows') is distinct from 'array' then raise exception 'Relatório inválido.';end if;
 select * into imp from technical_fabrication_imports where set_id=sid and digest=report->>'digest';
 if found then return jsonb_build_object('id',imp.id,'prodId',imp.prod_batch_id,'duplicate',true);end if;
 if exists(select 1 from technical_fabrication_imports where set_id=sid) then raise exception 'Já existe relatório neste ensaio. Use revisão, sem sobrescrever.';end if;
 if exists(select 1 from technical_prod_batches where company_id=co and contract_id=cid and upper(trim(batch_number))=upper(trim(num))) then raise exception 'Código de PROD já registrado.';end if;
 select array_agg(value) into allcodes from jsonb_array_elements_text(s.draft->'fabricationCodes');
 allcodes:=allcodes||array['P01','P11'];
 if cardinality(allcodes)<>(select count(distinct value->>'code') from jsonb_array_elements(report->'rows'))
 or cardinality(allcodes)<>jsonb_array_length(report->'rows')
 or exists(select 1 from jsonb_array_elements(report->'rows') where not(value->>'code'=any(allcodes)))
 then raise exception 'O relatório não corresponde aos recortes e itens individuais selecionados.';end if;
 -- Importing is not approving or consuming the contract's balance.
 insert into technical_prod_batches(company_id,contract_id,batch_number,status,description,cem_report,created_by)
 values(co,cid,num,'rascunho','HOMOLOGAÇÃO · conjunto de fabricação aguardando validação',report||jsonb_build_object('fabricationSetId',sid),actor) returning * into b;
 insert into technical_fabrication_imports(set_id,prod_batch_id,digest,report,created_by) values(sid,b.id,report->>'digest',report,actor) returning * into imp;
 for rowdata in select value from jsonb_array_elements(report->'rows') loop
  grouped:=rowdata->>'code' not in ('P01','P11'); pid:=null;
  if not grouped then
   select id into pid from technical_contract_pieces where company_id=co and contract_id=cid and code=rowdata->>'code' and deleted_at is null and status<>'cancelada' for update;
   if not found then raise exception 'Peça individual não localizada.';end if;
   insert into technical_prod_batch_pieces(prod_batch_id,piece_id) values(b.id,pid);
  end if;
  insert into technical_fabrication_items(import_id,set_id,piece_id,code,environment,quantity,width_mm,height_mm,area_m2,weight_kg)
  values(imp.id,case when grouped then sid end,pid,rowdata->>'code',rowdata->>'environment',(rowdata->>'quantity')::integer,(rowdata->>'width')::numeric,(rowdata->>'height')::numeric,(rowdata->>'area')::numeric,(rowdata->>'weight')::numeric);
 end loop;
 insert into audit_logs(company_id,entity,entity_id,action,user_id,after_data,notes)
 values(co,'technical_prod_batches',b.id,'fabrication_set_imported',actor,jsonb_build_object('setId',sid,'importId',imp.id,'report',report),'PDF importado em rascunho: conjunto coletivo e peças individuais separados. Não altera medidas, saldos ou aprovações.');
 return jsonb_build_object('id',imp.id,'prodId',b.id,'duplicate',false);
end $$;
revoke all on function technical_save_fabrication_set(uuid,uuid,uuid,jsonb,integer),technical_import_fabrication_set(uuid,uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function technical_save_fabrication_set(uuid,uuid,uuid,jsonb,integer),technical_import_fabrication_set(uuid,uuid,uuid,uuid,integer,text,jsonb) to service_role;
-- Grouped imports remain in review until downstream approval/balance support is homologated.
create function technical_guard_fabrication_preview() returns trigger language plpgsql set search_path=public as $$
begin
 if new.cem_report ? 'fabricationSetId' and new.status not in ('rascunho','cancelado') then
 raise exception 'Conjunto em homologação. Confira detalhamento, escopo e fluxo de aprovação antes de liberar esta PROD.';
 end if;
 return new;
end $$;
create trigger fabrication_preview_guard before insert or update on technical_prod_batches for each row execute function technical_guard_fabrication_preview();
commit;
