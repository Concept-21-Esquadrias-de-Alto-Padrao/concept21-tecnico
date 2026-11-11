"use client";
import {useState,useCallback} from "react";
import {useRouter} from "next/navigation";
import {ActionForm,Field,inputClass} from "./action-form";
import {saveMeasurementRequirement} from "@/app/measurement-requirement-actions";
import type {TechnicalPiece} from "@/lib/types";
export function MeasurementRequirementForm({piece,options}:{piece:TechnicalPiece;options:{id:string;label:string}[]}) {
 const [exempt,setExempt]=useState(!!piece.measurement_not_required);
 const router=useRouter(); const saved=useCallback(()=>router.refresh(),[router]);
 return <ActionForm action={saveMeasurementRequirement} onSuccess={saved} submitLabel="Salvar necessidade de medição" className="rounded-lg border border-slate-200 bg-slate-50 p-4">
 <input type="hidden" name="piece_id" value={piece.id}/><input type="hidden" name="contract_id" value={piece.contract_id}/>
 <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="measurement_not_required" checked={exempt} onChange={e=>setExempt(e.target.checked)}/>Não necessita medição em obra</label>
 <p className="text-sm text-slate-600">Para complementos ou peças dimensionadas no projeto do conjunto, sem medição individual. As medidas existentes são preservadas; as de fabricação vêm do CEM. Esta opção não libera nem aprova a peça.</p>
 <Field label="Motivo ou referência do projeto"><input className={inputClass} name="measurement_basis" required={exempt} defaultValue={piece.measurement_basis??""} placeholder="Ex.: perfil de acabamento definido no Itens da Obra"/></Field>
 <Field label="Peça vinculada (opcional)"><select className={inputClass} name="related_piece_id" defaultValue={piece.related_piece_id??""}><option value="">Sem vínculo</option>{options.filter(o=>o.id!==piece.id).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
 <p className="text-xs text-slate-500">O vínculo indica a relação entre peças. Não une quantidades nem transfere liberação automaticamente.</p>
 </ActionForm>;
}
