"use client";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { saveCommercialReceiptAction } from "@/app/commercial-receipt-actions";
import { CommercialEntryFields } from "@/components/commercial-entry-fields";
import { Field, inputClass, textareaClass } from "@/components/action-form";
import { type CommercialReceipt, type ReceiptDraft, type ReceiptPiece } from "@/lib/commercial-receipt";
import { manualContractSchema } from "@/lib/schemas";
import { parseCommercialEntry } from "@/lib/commercial-entry";
import { ACTIVITIES_CHANGED_EVENT } from "@/lib/my-activities-events";
import { toUserFriendlyErrorMessage } from "@/lib/errors";

const steps = ["Dados da obra", "Peças e desenhos", "Concluir conferência"];
export function CommercialReceiptWizard({contractId,initial}:{contractId:string;initial:CommercialReceipt}) {
  const [receipt,setReceipt] = useState(initial);
  const [draft,setDraft] = useState(initial.draft);
  const [step,setStep] = useState(initial.draft.step);
  const [dirty,setDirty] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const locked = receipt.status !== "pending";
  useEffect(()=>{
    if (!dirty && !busy) return;
    const unload=(e:BeforeUnloadEvent)=>{e.preventDefault(); e.returnValue="";};
    const click=(e:MouseEvent)=>{if(e.target instanceof Element && e.target.closest("a[href]") && (busy || !window.confirm("Há alterações não guardadas. Deseja sair sem salvar?"))){e.preventDefault();e.stopPropagation();}};
    window.addEventListener("beforeunload",unload); document.addEventListener("click",click,true);
    return ()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",click,true);};
  },[dirty,busy]);
  const changed=()=>{setDirty(true);setDraft(d=>({...d,dataChecked:false}));};
  function snapshot(nextStep=step): ReceiptDraft {
    const values = new FormData(form.current!);
    const get=(key:string)=>String(values.get(key) ?? "");
    const names=values.getAll("work_contact_name"),roles=values.getAll("work_contact_role"),phones=values.getAll("work_contact_phone");
    return {...draft,step:nextStep,data:{contract_number:get("contract_number"),client_name:get("client_name"),work_name:get("work_name"),full_address:get("full_address"),city:get("city"),state:get("state"),contract_date:get("contract_date"),contractual_deadline_value:get("contractual_deadline_value"),contractual_deadline_unit:get("contractual_deadline_unit") as "dias_corridos"|"dias_uteis",description:get("description"),contacts:names.map((name,i)=>({name:String(name),role:String(roles[i] ?? ""),phone:String(phones[i] ?? "")})),deliveryDate:get("commercial_delivery_date"),dateUnknown:values.get("delivery_date_unknown")==="on"}};
  }
  async function save(intent:"save"|"continue"|"finish", nextStep=step) {
    if(busy) return;
    let next = locked ? receipt.draft : snapshot(nextStep);
    try {
      if(intent==="continue" && step===0){manualContractSchema.parse(next.data);const fd=new FormData(form.current!);parseCommercialEntry(fd);if(!next.dataChecked) throw new Error("Marque a conferência dos dados da obra para continuar.");}
      if(intent==="continue" && step===1 && (!next.pieces.length || !next.drawingChecked || !next.reference.trim() || next.pieces.some(p=>!next.checkedIds.includes(p.id)))) throw new Error("Confira todas as peças e o desenho de referência antes de continuar.");
    } catch(e){setError(true);setMessage(toUserFriendlyErrorMessage(e,"Revise o preenchimento."));return;}
    setBusy(true);setMessage("");
    try {
      const result = await saveCommercialReceiptAction({contractId,version:receipt.version,intent,draft:next});
      setError(!result.ok); setMessage(result.message);
      if(result.receipt){setReceipt(result.receipt);setDraft(result.receipt.draft); next=result.receipt.draft;}
      if(result.ok){setDirty(false);setStep(next.step); window.dispatchEvent(new Event(ACTIVITIES_CHANGED_EVENT));}
    }catch(e){setError(true);setMessage(toUserFriendlyErrorMessage(e,"Falha na conexão. O preenchimento foi preservado."));}
    finally{setBusy(false);}
  }
  function updatePiece(id:string,values:Partial<ReceiptPiece>){setDraft(d=>({...d,pieces:d.pieces.map(p=>p.id===id?{...p,...values}:p),checkedIds:d.checkedIds.filter(value=>value!==id),drawingChecked:false}));setDirty(true);}
  const total=draft.pieces.reduce((n,p)=>n+p.quantity,0);
  const checked=draft.pieces.filter(p=>draft.checkedIds.includes(p.id)).reduce((n,p)=>n+p.quantity,0);
  const complete=receipt.status==="completed";
  const due=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(new Date(receipt.dueAt));
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-orange-700">Recebimento comercial</p><h1 className="mt-2 text-2xl font-semibold">Conferir recebimento do contrato</h1><p className="mt-2 text-sm text-muted-foreground">{draft.data.contract_number} · {draft.data.work_name}</p></div><Link href="/tecnico/contratos" className="inline-flex h-11 items-center gap-2 rounded-lg border bg-white px-4 text-sm"><ArrowLeft className="size-4"/>Voltar para Obras</Link></div>
    {complete ? <section className="rounded-2xl border border-green-200 bg-white p-7"><CheckCircle2 className="mb-3 size-8 text-green-700"/><h2 className="text-xl font-semibold">Conferência concluída</h2><p className="mt-2">{total} peça(s) conferida(s). A obra está disponível para o alinhamento comercial.</p><p className="mt-2 text-sm text-muted-foreground">Conclusão registrada em {new Date(receipt.completedAt!).toLocaleString("pt-BR")}.</p><Link href={`/tecnico/contratos/${contractId}#reuniao_ata`} className="mt-5 inline-flex rounded-lg bg-charcoal px-4 py-3 text-sm text-white">Abrir obra e alinhamento</Link></section> : <>
    <nav aria-label="Etapas da conferência" className="grid gap-3 sm:grid-cols-3">{steps.map((title,i)=><button key={title} type="button" disabled={busy||locked||i>step} onClick={()=>{if(i<step){setDraft(snapshot(i));setStep(i);setDirty(true);}}} aria-current={step===i?"step":undefined} className={`rounded-xl border p-4 text-left text-sm font-semibold disabled:cursor-default ${step===i?"border-orange-400 bg-orange-50 text-orange-900":"border-border bg-white"}`}>{i+1} · {title}</button>)}</nav>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_270px]"><form ref={form} onSubmit={e=>e.preventDefault()} className="min-w-0 rounded-2xl border border-border bg-white p-5 sm:p-7">
      <fieldset disabled={busy||locked} className="min-w-0">
      <section hidden={step!==0} aria-label="Dados da obra" className="space-y-5"><h2 className="text-lg font-semibold">Dados da obra</h2><p className="text-sm text-muted-foreground">Confira os dados comerciais, os contatos e os prazos. Alterações ficam guardadas nesta conferência até a conclusão.</p>
      <div className="grid gap-4 sm:grid-cols-2">{[["contract_number","Número do contrato"],["client_name","Cliente"],["work_name","Obra"],["full_address","Endereço da obra"],["city","Cidade"],["state","UF"],["contract_date","Data do contrato"]].map(([key,label])=><Field key={key} label={label}><input name={key} defaultValue={draft.data[key as keyof typeof draft.data] as string} readOnly={key==="contract_number"} type={key==="contract_date"?"date":"text"} className={inputClass} onChange={changed}/></Field>)}
      <Field label="Prazo contratual"><div className="grid grid-cols-2 gap-2"><input name="contractual_deadline_value" aria-label="Quantidade de dias" type="number" min="0" defaultValue={draft.data.contractual_deadline_value} className={inputClass} onChange={changed}/><select name="contractual_deadline_unit" aria-label="Tipo de prazo" defaultValue={draft.data.contractual_deadline_unit} className={inputClass} onChange={changed}><option value="dias_corridos">Dias corridos</option><option value="dias_uteis">Dias úteis</option></select></div></Field></div>
      <CommercialEntryFields initialContacts={draft.data.contacts} initialDate={draft.data.deliveryDate} initialUnknown={draft.data.dateUnknown} onDirtyChange={changed}/>
      <Field label="Descrição / observações"><textarea name="description" defaultValue={draft.data.description} className={textareaClass} onChange={changed}/></Field>
      <label className="flex items-center gap-3 rounded-lg bg-muted/40 p-4 text-sm"><input type="checkbox" checked={draft.dataChecked} onChange={e=>{setDraft(d=>({...d,dataChecked:e.target.checked}));setDirty(true);}}/>Dados do cliente, obra, contatos e prazo conferidos</label>
      </section>
      <section hidden={step!==1} aria-label="Peças e desenhos" className="space-y-5"><div><h2 className="text-lg font-semibold">Peças e desenhos recebidos</h2><p className="mt-1 text-sm text-muted-foreground">{draft.pieces.length} item(ns) · {total} peça(s) · {checked} conferida(s). Medidas comerciais em milímetros.</p></div>
      <Field label="Referência do desenho conferido"><input value={draft.reference} onChange={e=>{setDraft(d=>({...d,reference:e.target.value,drawingChecked:false}));setDirty(true);}} placeholder="Nome do arquivo, revisão ou referência no servidor" className={inputClass}/></Field>
      <p className="text-xs text-muted-foreground">Consulte o desenho no servidor da empresa. Os arquivos não são armazenados nesta tela.</p>
      {!draft.pieces.length && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Nenhuma peça cadastrada. Acrescente as peças do contrato para concluir o recebimento.</p>}
      {draft.pieces.map((piece,index)=><article key={piece.id} className="space-y-3 rounded-xl border border-border p-4"><h3 className="font-semibold">{piece.code || `Item ${index+1}`} · {piece.environment || "Ambiente a informar"}</h3><div className="grid gap-3 sm:grid-cols-3">{([['code','Código'],['environment','Ambiente'],['piece_type','Modelo / tipo']] as const).map(([key,label])=><Field key={key} label={label}><input aria-label={`${label} da peça ${index+1}`} value={piece[key]} onChange={e=>updatePiece(piece.id,{[key]:e.target.value})} className={inputClass}/></Field>)}<Field label="Quantidade"><input aria-label={`Quantidade da peça ${index+1}`} type="number" min="1" value={piece.quantity} onChange={e=>updatePiece(piece.id,{quantity:Number(e.target.value)})} className={inputClass}/></Field>{([['sale_width_mm','Largura comercial (mm)'],['sale_height_mm','Altura comercial (mm)']] as const).map(([key,label])=><Field key={key} label={label}><input aria-label={`${label} da peça ${index+1}`} type="number" min="0.01" step="any" value={piece[key]??""} onChange={e=>updatePiece(piece.id,{[key]:e.target.value?Number(e.target.value):null})} className={inputClass}/></Field>)}</div><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.checkedIds.includes(piece.id)} onChange={e=>{setDraft(d=>({...d,checkedIds:e.target.checked?[...d.checkedIds,piece.id]:d.checkedIds.filter(id=>id!==piece.id)}));setDirty(true);}}/>Peça conferida: código, ambiente, modelo, quantidade e medidas do desenho</label></article>)}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>{setDraft(d=>({...d,pieces:[...d.pieces,{id:crypto.randomUUID(),code:"",environment:"",piece_type:"",quantity:1,sale_width_mm:null,sale_height_mm:null,description:"",glass:"",color:"",line:""}],drawingChecked:false}));setDirty(true);}} className="min-h-11 rounded-lg border px-4 text-sm">Acrescentar peça</button><button type="button" disabled={!draft.pieces.length} onClick={()=>{setDraft(d=>({...d,checkedIds:d.pieces.map(p=>p.id)}));setDirty(true);}} className="min-h-11 rounded-lg border px-4 text-sm">Marcar todas como conferidas</button></div>
      <label className="flex items-center gap-3 rounded-lg bg-muted/40 p-4 text-sm"><input type="checkbox" checked={draft.drawingChecked} onChange={e=>{setDraft(d=>({...d,drawingChecked:e.target.checked}));setDirty(true);}}/>O desenho e a relação de peças correspondem ao contrato recebido</label><p className="text-xs text-muted-foreground">Esta conferência não substitui análise do CEM, medição de campo ou liberação para fabricação.</p>
      </section>
      <section hidden={step!==2} aria-label="Concluir conferência" className="space-y-5"><h2 className="text-lg font-semibold">Resumo da conferência</h2><dl className="divide-y divide-border text-sm"><div className="py-4"><dt className="font-semibold">Dados da obra</dt><dd>{draft.dataChecked?"Conferidos":"Pendentes"} · {draft.data.client_name}</dd></div><div className="py-4"><dt className="font-semibold">Peças e desenho</dt><dd>{checked} de {total} peça(s) conferida(s) · {draft.reference || "Referência pendente"}</dd></div><div className="py-4"><dt className="font-semibold">Previsão de entrega comercial</dt><dd>{draft.data.dateUnknown?"A definir na primeira visita · Warlley confirma / Anna acompanha":draft.data.deliveryDate.split("-").reverse().join("/")}</dd></div><div className="py-4"><dt className="font-semibold">Prazo contratual</dt><dd>{draft.data.contractual_deadline_value || "Não informado"} {draft.data.contractual_deadline_unit==="dias_corridos"?"dias corridos":"dias úteis"}</dd></div></dl><Field label="Observações para o alinhamento"><textarea className={textareaClass} value={draft.notes} onChange={e=>{setDraft(d=>({...d,notes:e.target.value}));setDirty(true);}}/></Field><p className="rounded-lg bg-orange-50 p-4 text-sm">Concluir encerra a atividade de recebimento e disponibiliza a obra para a reunião de alinhamento comercial. Não libera fabricação.</p></section>
      </fieldset>
      {message && <p role={error?"alert":"status"} className={`mt-5 rounded-lg p-4 text-sm ${error?"bg-red-50 text-red-800":"bg-green-50 text-green-800"}`}>{message}</p>}
      <div className="mt-6 flex flex-wrap gap-3 border-t pt-5">{step>0&&!locked&&<button type="button" disabled={busy} onClick={()=>{setDraft(snapshot(step-1));setStep(step-1);setDirty(true);}} className="min-h-11 rounded-lg border px-4 text-sm">Voltar</button>}{!locked&&<button type="button" disabled={busy} onClick={()=>save("save")} className="min-h-11 rounded-lg border px-4 text-sm">Guardar e continuar depois</button>}<button type="button" disabled={busy} onClick={()=>save(step===2||locked?"finish":"continue",Math.min(2,step+1))} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold">{busy&&<Loader2 className="size-4 animate-spin"/>}{busy?"Salvando...":locked?"Tentar concluir novamente":step===2?"Concluir e encaminhar para alinhamento":"Continuar"}</button></div>
    </form><aside className="h-fit rounded-2xl border bg-white p-5 text-sm"><ClipboardCheck className="mb-3 size-5 text-orange-600"/><h2 className="font-semibold">Atividade de recebimento</h2><p className="mt-4 text-muted-foreground">Responsável</p><p>{receipt.ownerName}</p><p className="mt-4 text-muted-foreground">Vencimento</p><p>{due} · Brasília</p><p className="mt-4 text-muted-foreground">{dirty?"Há alterações ainda não guardadas.":"Progresso guardado no sistema."}</p><Link href="/tecnico/minhas-atividades" className="mt-4 inline-block font-medium text-orange-800">Abrir Meu trabalho</Link></aside></div></>}
    <details className="rounded-xl border bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Histórico do recebimento</summary><ul className="mt-3 space-y-2">{receipt.history.map((item,i)=><li key={`${item.version}-${i}`}>{new Date(item.at).toLocaleString("pt-BR")} · {item.event} · registro {item.version}</li>)}</ul></details>
  </div>;
}
