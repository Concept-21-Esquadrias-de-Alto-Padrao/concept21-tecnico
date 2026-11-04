"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import type {CemItem} from "@/lib/cem-items";
import {Field,inputClass} from "./action-form";

type Preview={issued:string;batchNumber:string;digest:string;rows:(CemItem&{problem:string})[]};
export function CemImportForm({contracts}:{contracts:{id:string;label:string}[]}) {
  const [cid,setCid]=useState(""),[file,setFile]=useState<File|null>(null),[number,setNumber]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const router=useRouter();
  function clear(){setPreview(null);setMessage("");}
  async function submit(confirm:boolean){
    if(!file || !cid || busy) return;
    setBusy(true);setMessage("");
    try {
      const body=new FormData();
      body.set("file",file);body.set("contract_id",cid);body.set("batch_number",number);
      body.set("intent",confirm?"confirm":"preview");body.set("digest",preview?.digest ?? "");
      const response=await fetch("/api/technical/prods/import",{method:"POST",body});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || "Falha na leitura.");
      if(confirm){setMessage(data.message);setPreview(null);router.refresh();}
      else {setPreview(data);setNumber(data.batchNumber || number);}
    } catch(error){setMessage(error instanceof Error?error.message:"Falha ao importar.");}
    finally{setBusy(false);}
  }
  return <fieldset disabled={busy} className="space-y-3">
    <Field label="Obra"><select className={inputClass} value={cid} onChange={e=>{setCid(e.target.value);setNumber("");clear();}}>
      <option value="">Selecione o número e o cliente</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
    </select></Field>
    <Field label="Relatório Itens da Obra (PDF, até 4 MB)"><input className={inputClass} type="file" accept="application/pdf,.pdf" onChange={e=>{setFile(e.target.files?.[0]??null);setNumber("");clear();}}/></Field>
    <Field label="Código da PROD"><input className={inputClass} placeholder="Preenchido pelo PDF quando disponível" maxLength={100} value={number} onChange={e=>{setNumber(e.target.value);clear();}}/></Field>
    <button type="button" className="rounded border px-4 py-2 font-semibold disabled:opacity-50" disabled={!file||!cid||busy} onClick={()=>submit(false)}>Conferir PDF</button>
    {preview && <section className="space-y-2 rounded border p-3 text-sm">
      <p className="font-semibold">Emissão CEM · {preview.issued} · {preview.rows.reduce((sum,r)=>sum+r.quantity,0)} peças</p>
      {preview.rows.map(r=><p key={r.code} className="border-t pt-2"><strong>{r.code} · {r.environment}</strong><br/>{r.quantity} un. · Fabricação {r.width} × {r.height} mm · {r.area} m² · {r.weight} kg<br/>{r.problem || "Correspondência encontrada"}</p>)}
      {!number && <p>Informe o código da PROD e clique novamente em Conferir PDF.</p>}
      <button type="button" className="rounded bg-accent px-4 py-2 font-semibold disabled:opacity-50" disabled={!number.trim()||busy||preview.rows.some(r=>r.problem)} onClick={()=>submit(true)}>Confirmar registro da PROD</button>
    </section>}
    {busy && <p role="status">Processando o relatório…</p>}
    {message && <p role="status" className="rounded bg-muted p-3 text-sm">{message}</p>}
  </fieldset>;
}
