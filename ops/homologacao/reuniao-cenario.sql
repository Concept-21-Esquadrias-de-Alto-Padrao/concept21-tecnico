-- Execute ONLY on rnuanogfbhhphnnqxugf (Técnico TESTE). No production use.
begin;
do $$
declare p profiles%rowtype; cl uuid; c uuid; p1 uuid; p2 uuid;
begin
 select * into p from profiles where email='comercial.teste@concept21.local' and status='active' limit 1;
 if p.id is null then raise exception 'Perfil fictício de homologação ausente';end if;
 if exists(select 1 from production_contracts where company_id=p.company_id and contract_number='HML-REUNIAO-2810') then raise exception 'Cenário já criado. Preservado.';end if;
 insert into clients(company_id,name,active)values(p.company_id,'Cliente fictício — Homologação da reunião',true)returning id into cl;
 insert into production_contracts(company_id,contract_number,client_id,work_name,full_address,created_by)values(p.company_id,'HML-REUNIAO-2810',cl,'Obra modelo · Reunião comercial','Endereço fictício de homologação',p.user_id)returning id into c;
 insert into technical_contracts(company_id,contract_id,technical_status,commercial_data)values(p.company_id,c,'aguardando_reuniao','{"homologacao":true}');
 insert into technical_contract_pieces(company_id,contract_id,code,piece_type,environment,sale_width_mm,sale_height_mm) values(p.company_id,c,'P01','Porta de correr','Sala',2400,2200),(p.company_id,c,'J01','Janela maxim-ar','Cozinha',1200,1000),(p.company_id,c,'P02','Porta pivotante','Hall de entrada',1100,2400);
end $$;
commit;
select id,contract_number,work_name from production_contracts where contract_number='HML-REUNIAO-2810';
