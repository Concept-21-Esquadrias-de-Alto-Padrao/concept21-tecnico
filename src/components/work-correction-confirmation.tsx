"use client";
import {useRef,useState,type ReactNode} from 'react';
import {Loader2,Save} from 'lucide-react';
import type {ActionState} from './action-form';
import {correctionChanges,type CorrectionValues} from '@/lib/work-data-correction';
import {ACTIVITIES_CHANGED_EVENT} from '@/lib/my-activities-events';

export function WorkCorrectionConfirmation({action,contractNumber,initial,children}:{action:(state:ActionState,data:FormData)=>Promise<ActionState>;contractNumber:string;initial:CorrectionValues;children:ReactNode}){
 const form=useRef<HTMLFormElement>(null),dialog=useRef<HTMLDialogElement>(null),submit=useRef<HTMLButtonElement>(null),lock=useRef(false),baseline=useRef(initial);
 const [changes,setChanges]=useState<ReturnType<typeof correctionChanges>>([]),[busy,setBusy]=useState(false),[result,setResult]=useState<ActionState>({ok:false,message:''});
 const snapshot=useRef<FormData|null>(null);
 function cancel(){if(lock.current)return;dialog.current?.close();snapshot.current=null;submit.current?.focus();}
 async function save(){
  if(lock.current||!snapshot.current)return;
  lock.current=true;setBusy(true);setResult({ok:false,message:''});
  try{
   const state=await action({ok:false,message:''},snapshot.current);setResult(state);
   if(state.ok){for(const change of changes)baseline.current={...baseline.current,[change.key]:change.after};dialog.current?.close();snapshot.current=null;window.dispatchEvent(new Event(ACTIVITIES_CHANGED_EVENT));submit.current?.focus();}
  }catch{setResult({ok:false,message:'Não foi possível confirmar a gravação. O preenchimento foi preservado; tente novamente.'});}
  finally{lock.current=false;setBusy(false);}
 }
 return <form ref={form} className="space-y-4 rounded-lg border border-border bg-white p-4" onSubmit={event=>{
  event.preventDefault();if(lock.current)return;
  const data=new FormData(event.currentTarget);const diff=correctionChanges(baseline.current,data);
  if(!diff.length){setResult({ok:false,message:'Nenhum campo foi alterado.'});return;}
  data.set('correction_expected',JSON.stringify(baseline.current));
  snapshot.current=data;setChanges(diff);setResult({ok:false,message:''});dialog.current?.showModal();
 }}>
  <fieldset disabled={busy} className="space-y-4">{children}</fieldset>
  <button ref={submit} type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"><Save className="size-4"/>Salvar correção</button>
  {result.message&&!dialog.current?.open&&<p role={result.ok?'status':'alert'} className={'rounded-lg p-3 text-sm '+(result.ok?'bg-emerald-50 text-emerald-900':'bg-red-50 text-red-800')}>{result.message}</p>}
  <dialog ref={dialog} aria-labelledby="correction-title" aria-describedby="correction-description" onCancel={event=>{event.preventDefault();cancel();}} className="fixed inset-0 m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-white p-0 text-charcoal shadow-2xl backdrop:bg-slate-950/40">
   <div className="border-b border-border p-5"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Concept21 · Técnico · Contrato {contractNumber}</p><h2 id="correction-title" className="mt-2 text-xl font-semibold">Confirmar correção da obra?</h2><p id="correction-description" className="mt-2 text-sm text-muted-foreground">Confira somente os campos alterados. A correção e seu motivo ficarão registrados no histórico do contrato.</p></div>
   <div className="p-5"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-2">Campo</th><th className="p-2">Valor anterior</th><th className="p-2">Novo valor</th></tr></thead><tbody>{changes.map(c=><tr key={c.key} className="border-b border-border"><th className="p-2 align-top">{c.label}</th><td className="whitespace-pre-wrap break-words p-2 align-top text-muted-foreground">{c.before||'Não informado'}</td><td className="whitespace-pre-wrap break-words bg-slate-50 p-2 align-top font-medium">{c.after||'Não informado'}</td></tr>)}</tbody></table></div>{result.message&&!result.ok&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{result.message}</p>}</div>
   <div className="flex justify-end gap-3 border-t border-border bg-slate-50 p-5"><button type="button" autoFocus disabled={busy} onClick={cancel} className="min-h-11 rounded-lg border border-border bg-white px-4 font-semibold disabled:opacity-60">Cancelar</button><button type="button" disabled={busy} onClick={save} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 font-semibold text-white disabled:opacity-60">{busy&&<Loader2 className="size-4 animate-spin"/>}{busy?'Salvando…':'Confirmar e salvar'}</button></div>
  </dialog>
 </form>;
}
