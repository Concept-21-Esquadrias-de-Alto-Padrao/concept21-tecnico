"use client";
import {Fragment,useCallback,useState,type ReactNode} from "react";
import {useRouter} from "next/navigation";
import {ActionForm,Field,inputClass} from "./action-form";
import {createReleaseBatchAction} from "@/app/actions";

type Item={id:string;code:string;environment:string;model:string;width:number|null;height:number|null;released:boolean;blocked:boolean;registered:boolean;checked:boolean;lot:string;editor:ReactNode};
const clean=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function MeasurementDesk({contractId,items,canRelease,needsSignatures}:{contractId:string;items:Item[];canRelease:boolean;needsSignatures:boolean}){
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[edit,setEdit]=useState("");
  const [selection,setSelection]=useState<string[]>([]),[prepare,setPrepare]=useState(false);
  const router=useRouter();
  const saved=useCallback(()=>{setPrepare(false);setSelection([]);router.refresh();},[router]);
  const selected=items.filter(i=>selection.includes(i.id)&&!i.released&&!i.blocked);
  const visible=items.filter(i=>(filter==="all" || (filter==="pending"&&!i.released) || (filter==="released"&&i.released) || (filter==="cem"&&!(i.registered&&i.checked)))&&clean([i.code,i.environment,i.model,i.lot].join(" ")).includes(clean(query.trim())))
    .sort((a,b)=>Number(a.released)-Number(b.released)||a.code.localeCompare(b.code,"pt-BR",{numeric:true}));
  if(prepare&&selected.length) return <div className="rounded-lg border border-orange-200 bg-white p-4">
    <button type="button" onClick={()=>setPrepare(false)} className="mb-2 text-sm underline">Voltar à seleção</button>
    <h3 className="mb-1 font-semibold">Registrar medidas e liberar lote</h3>
    <p className="mb-4 text-sm">{selected.length} item(ns) selecionado(s) · Medidas de campo em milímetros. {needsSignatures?"Este lote exigirá assinatura.":"Este lote dispensa assinatura."}</p>
    <ActionForm action={createReleaseBatchAction} onSuccess={saved} submitLabel="Confirmar liberação do lote" confirmMessage="Confirma as medidas de campo e a liberação das peças selecionadas?">
      <input type="hidden" name="contract_id" value={contractId}/>
      {selected.map(i=><fieldset key={i.id} className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">{i.code} · {i.environment} · {i.model}</legend>
        <input type="hidden" name="piece_ids" value={i.id}/>
        <div className="grid gap-3 md:grid-cols-3"><Field label="Ambiente"><input className={inputClass} name={"environment_"+i.id} defaultValue={i.environment}/></Field>
        <Field label="Largura de campo (mm)"><input type="number" min="0.01" step="any" required className={inputClass} name={"measured_width_mm_"+i.id} defaultValue={i.width??""}/></Field>
        <Field label="Altura de campo (mm)"><input type="number" min="0.01" step="any" required className={inputClass} name={"measured_height_mm_"+i.id} defaultValue={i.height??""}/></Field></div>
      </fieldset>)}
      <div className="grid gap-3 md:grid-cols-2"><Field label="Identificação do lote (opcional)"><input className={inputClass} name="batch_number" placeholder="Numeração automática"/></Field>
        <Field label="Prazo do lote (opcional)"><input className={inputClass} name="default_due_date" type="date"/></Field></div>
      <Field label="Observações do lote"><textarea className={inputClass} name="notes"/></Field>
    </ActionForm>
  </div>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-3"><label className="grid flex-1 gap-1 text-sm">Buscar peça<input className={inputClass} type="search" placeholder="Código, ambiente, modelo ou lote" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label className="grid gap-1 text-sm">Mostrar<select value={filter} className={inputClass} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as peças</option><option value="pending">A liberar</option><option value="released">Já liberadas</option><option value="cem">CEM pendente</option></select></label>
      {canRelease&&<button className="rounded-md bg-accent px-4 py-2 font-semibold disabled:opacity-50" type="button" disabled={!selected.length} onClick={()=>setPrepare(true)}>Preparar lote ({selected.length})</button>}
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Medição, liberação e conferência CEM por peça</caption>
      <thead className="bg-muted"><tr>{["Peça","Ambiente / modelo","Campo (L × A)","Liberação","CEM",""].map(label=><th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
      <tbody>{visible.map(i=><Fragment key={i.id}><tr className="border-b">
        <td className="whitespace-nowrap p-2 font-semibold">{canRelease&&!i.released&&!i.blocked&&<input className="mr-2" type="checkbox" aria-label={"Incluir "+i.code+" no lote"} checked={selection.includes(i.id)} onChange={e=>setSelection(e.target.checked?[...selection,i.id]:selection.filter(id=>id!==i.id))}/>} {i.code}</td>
        <td className="p-2">{i.environment}<small className="block">{i.model}</small></td><td className="p-2">{i.width&&i.height?i.width+" × "+i.height+" mm":"A medir"}</td>
        <td className="p-2"><span className={i.released?"text-green-800":"text-amber-900"}>{i.released?"Liberada":i.blocked?"Bloqueada":"A liberar"}</span><small className="block">{i.lot}</small></td>
        <td className="p-2">{i.checked&&i.registered?"Conferida":i.registered?"A conferir":"A cadastrar"}</td>
        <td className="p-2"><button type="button" aria-expanded={edit===i.id} className="font-semibold underline" onClick={()=>setEdit(edit===i.id?"":i.id)}>{edit===i.id?"Fechar":"Ver peça"}</button></td>
      </tr>{edit===i.id&&<tr><td colSpan={6} className="bg-muted/30 p-3">{i.editor}</td></tr>}</Fragment>)}</tbody></table></div>
    {!visible.length&&<p className="text-sm">Nenhuma peça para esta seleção.</p>}
  </div>;
}
