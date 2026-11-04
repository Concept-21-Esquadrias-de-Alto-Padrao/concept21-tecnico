"use client";
import {useState,type ReactNode} from "react";
import {formatDate} from "@/lib/utils";
type Entry={id:string;day:string;time:string;kind:string;team:string;status:string;content:ReactNode};
const labels={next:"Agendadas",return:"Relatórios pendentes",past:"Histórico"};
function group(v:Entry){return v.status==="agendada"?"next":v.status==="aguardando_relatorio"?"return":"past";}
export function WorkVisits({visits,schedule}:{visits:Entry[];schedule?:ReactNode}){
  const [view,setView]=useState<keyof typeof labels>(visits.some(v=>group(v)==="return")?"return":visits.some(v=>group(v)==="next")?"next":visits.length?"past":"next");
  const rows=visits.filter(v=>group(v)===view).sort((a,b)=>(view==="past"?-1:1)*(a.day+a.time).localeCompare(b.day+b.time));
  return <div className="space-y-4 xl:col-span-2">
    {schedule&&<details className="rounded-lg border bg-white p-3"><summary className="cursor-pointer font-semibold text-orange-900">Agendar visita</summary><div className="mt-4">{schedule}</div></details>}
    <div className="flex flex-wrap gap-2">{(Object.keys(labels) as (keyof typeof labels)[]).map(k=><button type="button" key={k} aria-pressed={view===k} onClick={()=>setView(k)} className={"rounded-full border px-3 py-1.5 text-sm font-semibold "+(view===k?"bg-charcoal text-white":"bg-white")}>{labels[k]} · {visits.filter(v=>group(v)===k).length}</button>)}</div>
    {rows.map(v=><details key={v.id} className="rounded-lg border bg-white p-3"><summary className="cursor-pointer text-sm"><strong>{formatDate(v.day)} {v.time.slice(0,5)} · {v.kind}</strong> · {v.team || "Técnico a definir"} · {v.status.replaceAll("_"," ")}</summary><div className="mt-3">{v.content}</div></details>)}
    {!rows.length&&<p className="rounded-lg bg-muted/40 p-3 text-sm">{view==="next"?"Nenhuma visita agendada.":view==="return"?"Nenhum relatório pendente.":"Nenhuma visita no histórico."}</p>}
  </div>;
}
