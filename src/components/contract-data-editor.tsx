"use client";
import {useId,useState,type ReactNode} from 'react';
import {Pencil,X} from 'lucide-react';

export function ContractDataEditor({children,actions,status}:{children?:ReactNode;actions?:ReactNode;status?:ReactNode}){
 const [open,setOpen]=useState(false);
 const editorId=useId();
 return <section aria-label="Ações do cadastro" className="rounded-xl border border-border bg-white p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex flex-wrap items-center gap-2">
    {children&&<button type="button" aria-expanded={open} aria-controls={editorId} onClick={()=>setOpen(!open)} className={open?'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold':'inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white'}>{open?<><X className="size-4"/>Cancelar edição</>:<><Pencil className="size-4"/>Editar cadastro</>}</button>}
    {actions}
   </div>
   {status}
  </div>
  {open&&children&&<div id={editorId} className="mt-4 border-t border-border pt-4"><h3 className="font-semibold">Editar cadastro</h3><p className="mb-4 mt-1 text-sm text-muted-foreground">As alterações ficam registradas no histórico do contrato.</p>{children}</div>}
 </section>;
}
