"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { planReleaseAction } from "@/app/actions";
import { formatDate } from "@/lib/utils";
import { ActionForm } from "./action-form";

const states = {
  missing: {label:"Sem previsão", color:"bg-amber-100 text-amber-950"},
  planned: {label:"Prevista", color:"bg-blue-100 text-blue-950"},
  released: {label:"Liberada", color:"bg-green-100 text-green-950"},
} as const;
type State = keyof typeof states;
type Row = {
  id:string; code:string; environment:string; model:string; units:number; status:State;
  date:string|null; delivery:string; revise:boolean; group:string|null; lotId:string; lot:string; prod:string;
};
const normalize = (s:string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const columns = {code:"Peça", environment:"Ambiente", model:"Tipo / modelo", status:"Situação", date:"Liberação", delivery:"Previsão de entrega", lot:"Lote"} as const;
type Column = keyof typeof columns;
const keys = Object.keys(columns) as Column[];
const collator = new Intl.Collator("pt-BR",{numeric:true,sensitivity:"base"});
const statusRank = {missing:"1", planned:"2", released:"3"};
function sortValue(row:Row,key:Column) {
  if(key==="status") return statusRank[row.status];
  if(key==="date") return row.date?.slice(0,10) || "";
  if(key==="delivery") return /^(\d{2})\/(\d{2})\/(\d{4})$/.test(row.delivery) ? row.delivery.split("/").reverse().join("-") : "";
  return row[key]==="A definir" ? "" : row[key];
}
export function WorkPieceTable({rows,contractId,today,editable}:{rows:Row[];contractId:string;today:string;editable:boolean}){
  const [filter,setFilter]=useState<State|"all">("all");
  const [search,setSearch]=useState("");
  const [lot,setLot]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const router=useRouter();
  const saved=useCallback(()=>{setSelected([]);router.refresh();},[router]);
  const [sort,setSort]=useState<{key:Column;desc:boolean}>({key:"status",desc:false});
  function toggle(key:Column){setSort(old=>({key,desc:old.key===key && !old.desc}));}
  const visible=rows.filter(r=>(filter==="all"||r.status===filter)&&(!lot||r.lotId===lot)&&normalize([r.code,r.environment,r.model].join(" ")).includes(normalize(search.trim())))
    .sort((a,b)=>{
      const left=sortValue(a,sort.key), right=sortValue(b,sort.key);
      if(Boolean(left)!==Boolean(right)) return left ? -1 : 1;
      return (sort.desc?-1:1)*collator.compare(left,right)||collator.compare(a.code,b.code);
    });
  const lots=new Map(rows.filter(r=>r.lotId).map(r=>[r.lotId,r.lot]));
  const chosen=rows.filter(r=>selected.includes(r.id)&&r.status!=="released");
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2" aria-label="Filtrar peças por situação">
      {(["all","missing","planned","released"] as const).map(key=><button type="button" key={key} aria-pressed={filter===key}
        onClick={()=>{setFilter(key);setSelected([]);}} className={"rounded-full px-3 py-1.5 text-sm font-semibold "+(key==="all"?"bg-slate-100 text-slate-900":states[key].color)+(filter===key?" ring-2 ring-charcoal ring-offset-1":"")}>
        {key==="all"?"Todas":key==="planned"?"Previstas":key==="released"?"Liberadas":"Sem previsão"} · {rows.filter(r=>key==="all"||r.status===key).reduce((s,r)=>s+r.units,0)}
      </button>)}
    </div>
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="grid flex-1 gap-1">Buscar peça<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setSelected([]);}} placeholder="Código, ambiente ou modelo" className="rounded-md border p-2"/></label>
      <label className="grid gap-1">Lote<select value={lot} onChange={e=>{setLot(e.target.value);setSelected([]);}} className="rounded-md border bg-white p-2"><option value="">Todos os lotes</option>
        {[...lots].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR",{numeric:true})).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-sm lg:hidden"><label>Ordenar por <select className="rounded border p-2" value={sort.key} onChange={e=>setSort({key:e.target.value as Column,desc:false})}>{keys.map(k=><option value={k} key={k}>{columns[k]}</option>)}</select></label>
      <button type="button" className="rounded border px-3 py-2" onClick={()=>toggle(sort.key)}>{sort.desc?"↓ Decrescente":"↑ Crescente"}</button></div>
    {editable && <div className="rounded-md bg-muted/40 p-2 text-sm">
      {chosen.length ? <ActionForm action={planReleaseAction} onSuccess={saved} submitLabel="Guardar previsão">
        <input type="hidden" name="contract_id" value={contractId}/><input type="hidden" name="seen" value={JSON.stringify(Object.fromEntries(chosen.map(r=>[r.id,r.group])))}/>
        {chosen.map(r=><input key={r.id} type="hidden" name="piece_ids" value={r.id}/>)}
        <label>Previsão de liberação para {chosen.length} item(ns) selecionado(s) <input className="rounded border p-1" type="date" name="forecast_date" required min={today}/></label>
      </ActionForm> : "Selecione as peças pendentes para informar ou alterar a previsão."}
    </div>}
    <table className="block w-full text-left text-sm lg:table"><caption className="sr-only">Peças, situação e previsões de liberação e entrega</caption>
      <thead className="hidden bg-muted lg:table-header-group"><tr>{keys.map(k=><th scope="col" aria-sort={sort.key===k?(sort.desc?"descending":"ascending"):undefined} key={k}>
        <button type="button" onClick={()=>toggle(k)} className="w-full rounded p-2 text-left hover:bg-orange-50" aria-label={"Ordenar por "+columns[k]+" em ordem "+(sort.key===k&&!sort.desc?"decrescente":"crescente")}>{columns[k]} <span aria-hidden="true">{sort.key===k?(sort.desc?"↓":"↑"):"↕"}</span></button>
      </th>)}</tr></thead>
      <tbody className="block lg:table-row-group">{visible.map(r=><tr key={r.id} className="grid grid-cols-2 gap-1 border-b py-2 lg:table-row">
        <td className="p-2 font-semibold">{editable&&r.status!=="released"&&<input type="checkbox" className="mr-2" aria-label={"Selecionar "+r.code} checked={selected.includes(r.id)} onChange={e=>setSelected(e.target.checked?[...selected,r.id]:selected.filter(id=>id!==r.id))}/>}
          {r.code}{r.units>1&&" × "+r.units}</td>
        <td className="p-2">{r.environment}</td><td className="p-2">{r.model}</td>
        <td className="p-2"><span className={"whitespace-nowrap rounded-full px-2 py-1 font-semibold "+states[r.status].color}>{states[r.status].label}</span>{r.revise&&<small className="block pt-1">Revisar data</small>}</td>
        <td className="p-2"><small className="block lg:hidden">Liberação</small>{r.date?formatDate(r.date.slice(0,10)):"A definir"}</td>
        <td className="p-2"><small className="block lg:hidden">Previsão de entrega</small>{r.date?r.delivery:"—"}</td>
        <td className="p-2">{r.lot || (r.status==="released"?"Sem lote vinculado":"—")}{r.prod&&<small className="block">{r.prod}</small>}</td>
      </tr>)}</tbody>
    </table>{visible.length===0 && <p className="text-sm text-muted-foreground">Nenhuma peça para esta seleção.</p>}
  </div>;
}
