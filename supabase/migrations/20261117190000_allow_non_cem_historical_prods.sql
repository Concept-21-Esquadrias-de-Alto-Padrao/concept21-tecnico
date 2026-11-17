begin;
set local lock_timeout='5s'; set local statement_timeout='45s';
do $$ declare definition text; begin
 select pg_get_functiondef('technical_guard_fabrication_preview()'::regprocedure) into definition;
 if position('if not(new.cem_report ? ''fabricationSetId'') then return new; end if;' in definition)>0 then
  definition:=replace(definition,'if not(new.cem_report ? ''fabricationSetId'') then return new; end if;','if not coalesce(new.cem_report ? ''fabricationSetId'',false) then return new; end if;');
  execute definition;
 elsif position('if not coalesce(new.cem_report ? ''fabricationSetId'',false) then return new; end if;' in definition)=0 then raise exception 'Guard mudou; revisar antes';end if;
end $$;
commit;

