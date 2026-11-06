"use client";
import {useState,type ReactNode} from 'react';
import {Pencil,X} from 'lucide-react';
export function ContractDataEditor({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <section className="rounded-xl border border-border bg-white p-5">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Atualizar cadastro</h3><p className="mt-1 text-sm text-muted-foreground">Edite os dados somente quando precisar. As alterações mantêm o histórico.</p></div><button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className={open?'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold':'inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white'}>{open?<><X className="size-4"/>Cancelar edição</>:<><Pencil className="size-4"/>Editar dados</>}</button></div>
 {open&&<div className="mt-5">{children}</div>}
 </section>;
}
