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
export function WorkPieceTable({rows,contractId,today,editable}:{rows:Row[];contractId:string;today:string;editable:boolean}){
  const [filter,setFilter]=useState<State|"all">("all");
  const [search,setSearch]=useState("");
  const [lot,setLot]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const router=useRouter();
  const saved=useCallback(()=>{setSelected([]);router.refresh();},[router]);
  const order = {missing:0,planned:1,released:2};
  const visible=rows.filter(r=>(filter==="all"||r.status===filter)&&(!lot||r.lotId===lot)&&normalize([r.code,r.environment,r.model].join(" ")).includes(normalize(search.trim())))
    .sort((a,b)=>order[a.status]-order[b.status]||a.code.localeCompare(b.code,"pt-BR",{numeric:true}));
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
    {editable && <div className="rounded-md bg-muted/40 p-2 text-sm">
      {chosen.length ? <ActionForm action={planReleaseAction} onSuccess={saved} submitLabel="Guardar previsão">
        <input type="hidden" name="contract_id" value={contractId}/><input type="hidden" name="seen" value={JSON.stringify(Object.fromEntries(chosen.map(r=>[r.id,r.group])))}/>
        {chosen.map(r=><input key={r.id} type="hidden" name="piece_ids" value={r.id}/>)}
        <label>Previsão de liberação para {chosen.length} item(ns) selecionado(s) <input className="rounded border p-1" type="date" name="forecast_date" required min={today}/></label>
      </ActionForm> : "Selecione as peças pendentes para informar ou alterar a previsão."}
    </div>}
    <table className="block w-full text-left text-sm lg:table"><caption className="sr-only">Peças, situação e previsões de liberação e entrega</caption>
      <thead className="hidden bg-muted lg:table-header-group"><tr>{["Peça","Ambiente","Tipo / modelo","Situação","Liberação","Previsão de entrega","Lote"].map(s=><th className="p-2" key={s}>{s}</th>)}</tr></thead>
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
