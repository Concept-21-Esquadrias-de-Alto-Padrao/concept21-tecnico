"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { ActionForm } from "./action-form";
import { planReleaseAction } from "@/app/actions";

type Option = {id:string; label:string; group:string|null; date:string|null; replan:boolean};
export function PieceForecastForm({contractId, options, today}:{contractId:string; options:Option[]; today:string}) {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();
  const saved = useCallback(() => {setSelected([]); router.refresh();}, [router]);
  return <details className="mt-2 rounded border p-2"><summary className="cursor-pointer font-semibold">Informar ou alterar previsão</summary>
    <ActionForm action={planReleaseAction} submitLabel="Guardar previsão" onSuccess={saved}>
      <input type="hidden" name="contract_id" value={contractId}/>
      <input type="hidden" name="seen" value={JSON.stringify(Object.fromEntries(options.map(p=>[p.id,p.group])))}/>
      <label className="mt-3 flex gap-2"><input type="checkbox" checked={options.length>0 && options.every(p=>selected.includes(p.id))}
        onChange={e=>setSelected(e.target.checked ? options.map(p=>p.id) : [])}/>Selecionar todo o saldo</label>
      <div className="max-h-52 space-y-2 overflow-auto">{options.map(p=><label key={p.id} className="flex gap-2">
        <input name="piece_ids" value={p.id} type="checkbox" checked={selected.includes(p.id)}
          onChange={e=>setSelected(e.target.checked ? [...selected,p.id] : selected.filter(id=>id!==p.id))}/>
        {p.label} · {p.date ? formatDate(p.date) + (p.replan ? " · revisar" : "") : "Sem previsão"}
      </label>)}</div>
      <label className="block">Previsão de liberação <input type="date" name="forecast_date" required min={today} className="rounded border p-1"/></label>
    </ActionForm>
  </details>;
}
