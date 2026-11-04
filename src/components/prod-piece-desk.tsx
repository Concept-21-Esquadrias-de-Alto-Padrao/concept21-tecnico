"use client";
import {Fragment,useState} from "react";
import {updatePieceCemAction} from "@/app/actions";
import {ActionForm} from "./action-form";
import {formatDate} from "@/lib/utils";

type Row={id:string;code:string;environment:string;model:string;qty:number;lot:string;released:string;due:string;registered:boolean;checked:boolean;prod:string;reason:string;manufacturing:string};
const cols={code:"Peça",environment:"Ambiente",model:"Tipo / modelo",lot:"Lote",released:"Liberação",due:"Prazo de emissão",cem:"CEM",manufacturing:"Fabricação (mm)",prod:"PROD"} as const;
const collator=new Intl.Collator("pt-BR",{numeric:true,sensitivity:"base"});
export function ProdPieceDesk({rows,editable}:{rows:Row[];editable:boolean}){
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[edit,setEdit]=useState("");
  const [sort,setSort]=useState<{key:keyof typeof cols;desc:boolean}>({key:"code",desc:false});
  const enriched=rows.map(r=>({...r,cem:r.registered?(r.checked?"Conferida":"A conferir"):"A cadastrar"}));
  const visible=enriched.filter(r=>(filter==="all"||(filter==="cem"&&!r.checked)||(filter==="ready"&&r.released&&!r.reason&&!r.prod)||(filter==="issued"&&r.prod))&&[r.code,r.environment,r.model,r.lot,r.prod].join(" ").toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")))
    .sort((a,b)=>{const x=a[sort.key],y=b[sort.key];return Number(!x)-Number(!y)||(sort.desc?-1:1)*collator.compare(x,y)||collator.compare(a.code,b.code);});
  return <section className="space-y-3 rounded-xl border bg-white p-4 xl:col-span-2">
    <h3 className="font-semibold">Peças para emissão de PROD</h3>
    <div className="flex flex-wrap gap-3 text-sm"><label>Buscar peça <input type="search" className="rounded border p-2" placeholder="Peça, ambiente, lote ou PROD" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Mostrar <select className="rounded border p-2" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as peças</option><option value="cem">CEM pendente</option><option value="ready">Prontas para emissão</option><option value="issued">Com PROD</option></select></label></div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Conferência das peças e emissão de ordens</caption><thead className="bg-muted"><tr>{(Object.keys(cols) as (keyof typeof cols)[]).map(k=><th key={k} aria-sort={sort.key===k?(sort.desc?"descending":"ascending"):undefined}><button type="button" className="p-2 text-left" onClick={()=>setSort({key:k,desc:sort.key===k&&!sort.desc})}>{cols[k]} {sort.key===k?(sort.desc?"↓":"↑"):"↕"}</button></th>)}</tr></thead>
      <tbody>{visible.map(r=><Fragment key={r.id}><tr className="border-b">
        <td className="p-2 font-semibold">{r.code}{r.qty>1&&" × "+r.qty}</td><td className="p-2">{r.environment}</td><td className="p-2">{r.model}</td><td className="p-2">{r.lot||"—"}</td>
        <td className="p-2">{r.released?formatDate(r.released):"A liberar"}</td><td className="p-2">{r.due?formatDate(r.due):"—"}</td>
        <td className="p-2">{editable&&!r.prod?<button type="button" aria-expanded={edit===r.id} aria-label={"Conferência CEM de "+r.code} className="underline" onClick={()=>setEdit(edit===r.id?"":r.id)}>{r.cem}</button>:r.cem}</td>
        <td className="p-2">{r.manufacturing||"—"}</td><td className="p-2">{r.prod||r.reason||"A emitir"}</td></tr>
        {edit===r.id&&editable&&!r.prod&&<tr><td colSpan={9} className="p-3"><ActionForm action={updatePieceCemAction} submitLabel="Atualizar CEM">
          <input type="hidden" name="id" value={r.id}/><strong>Conferência no CEM · {r.code}</strong>
          <div className="flex gap-4"><label><input type="checkbox" name="cem_registered" defaultChecked={r.registered}/> Cadastrada</label><label><input type="checkbox" name="cem_checked" defaultChecked={r.checked}/> Conferida</label></div>
        </ActionForm></td></tr>}</Fragment>)}</tbody></table></div>
    {!visible.length&&<p>Nenhuma peça nesta seleção.</p>}
  </section>;
}
