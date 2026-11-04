"use client";
import {useState} from "react";
import {CemImportForm} from "./cem-import-form";
import {formatDate} from "@/lib/utils";

type Row={id:string;code:string;environment:string;model:string;qty:number;lot:string;released:string;due:string;issued:string;prod:string;reason:string;manufacturing:string};
const cols={code:"Peça",environment:"Ambiente",model:"Tipo / modelo",lot:"Lote",released:"Liberação",due:"Previsão de emissão da PROD",cem:"Itens da Obra",issued:"Emissão do relatório",manufacturing:"Fabricação L × A (mm)",prod:"Código da PROD"} as const;
const collator=new Intl.Collator("pt-BR",{numeric:true,sensitivity:"base"});
export function ProdPieceDesk({rows,editable,contractId}:{rows:Row[];editable:boolean;contractId:string}){
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("all");
  const [sort,setSort]=useState<{key:keyof typeof cols;desc:boolean}>({key:"code",desc:false});
  const enriched=rows.map(r=>({...r,cem:r.issued?"OK":"Pendente"}));
  const visible=enriched.filter(r=>(filter==="all"||(filter==="cem"&&!r.issued)||(filter==="ready"&&r.released&&!r.reason&&!r.prod)||(filter==="issued"&&r.prod))&&[r.code,r.environment,r.model,r.lot,r.prod].join(" ").toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")))
    .sort((a,b)=>{const value=(r:typeof a)=>sort.key==="issued"?r.issued.split("/").reverse().join("-"):r[sort.key];const x=value(a),y=value(b);return Number(!x)-Number(!y)||(sort.desc?-1:1)*collator.compare(x,y)||collator.compare(a.code,b.code);});
  return <section className="space-y-3 rounded-xl border bg-white p-4 xl:col-span-2">
    <h3 className="font-semibold">Relatório de emissão de PRODs</h3><p className="text-sm">A previsão é de cinco dias úteis após a liberação efetiva. O OK e a data de emissão vêm do relatório Itens da Obra.</p>
    {editable&&<div className="rounded-lg border border-orange-200 bg-orange-50/40 p-3"><h4 className="font-semibold text-orange-900">Lançar PROD · Importar Itens da Obra</h4><p className="my-3 text-sm">Selecione o PDF desta obra. Confira o código da PROD, a data de emissão e a largura e altura de fabricação de cada peça antes de confirmar.</p><CemImportForm fixedContractId={contractId} contracts={[]}/></div>}
    <div className="flex flex-wrap gap-3 text-sm"><label>Buscar peça <input type="search" className="rounded border p-2" placeholder="Peça, ambiente, lote ou PROD" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Mostrar <select className="rounded border p-2" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as peças</option><option value="cem">Sem Itens da Obra</option><option value="ready">Prontas para emissão</option><option value="issued">Com PROD</option></select></label></div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Conferência das peças e emissão de ordens</caption><thead className="bg-muted"><tr>{(Object.keys(cols) as (keyof typeof cols)[]).map(k=><th key={k} aria-sort={sort.key===k?(sort.desc?"descending":"ascending"):undefined}><button type="button" className="p-2 text-left" onClick={()=>setSort({key:k,desc:sort.key===k&&!sort.desc})}>{cols[k]} {sort.key===k?(sort.desc?"↓":"↑"):"↕"}</button></th>)}</tr></thead>
      <tbody>{visible.map(r=><tr key={r.id} className="border-b">
        <td className="p-2 font-semibold">{r.code}{r.qty>1&&" × "+r.qty}</td><td className="p-2">{r.environment}</td><td className="p-2">{r.model}</td><td className="p-2">{r.lot||"—"}</td>
        <td className="p-2">{r.released?formatDate(r.released):"A liberar"}</td><td className="p-2">{r.due?formatDate(r.due):"—"}</td>
        <td className="p-2"><span className={r.issued?"rounded bg-green-100 px-2 py-1 font-semibold text-green-900":"text-muted-foreground"}>{r.cem}</span></td><td className="p-2">{r.issued||"—"}</td>
        <td className="p-2">{r.manufacturing||"—"}</td><td className="p-2">{r.prod||"—"}{!r.prod&&<small className="block">{r.reason||"A emitir"}</small>}</td></tr>
)}</tbody></table></div>
    {!visible.length&&<p>Nenhuma peça nesta seleção.</p>}
  </section>;
}
