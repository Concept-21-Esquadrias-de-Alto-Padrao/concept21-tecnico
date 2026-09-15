"use client";

import { useState, type ChangeEvent } from "react";
import { createManualContractAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import type { Profile } from "@/lib/types";

const initialValues = {
  contract_number: "", client_name: "", contract_date: "", contractual_deadline_value: "",
  contractual_deadline_unit: "dias_uteis", work_name: "", full_address: "", city: "Goiânia", state: "GO",
  technical_manager_profile_id: "", followup_profile_id: "", description: "",
};

export function ManualContractForm({ profiles, saving, onDirtyChange, onPendingChange, onSuccess }: {
  profiles: Pick<Profile, "id" | "name">[];
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onSuccess: (message: string) => void;
}) {
  const [values, setValues] = useState(initialValues);
  function field(name: keyof typeof initialValues) {
    return {
      name,
      value: values[name],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const next = { ...values, [name]: event.target.value };
        setValues(next);
        onDirtyChange(Object.entries(initialValues).some(([key, value]) => next[key as keyof typeof next] !== value));
      },
    };
  }

  return (
    <ActionForm action={createManualContractAction} submitLabel="Salvar contrato" onPendingChange={onPendingChange} onSuccess={onSuccess}>
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número do contrato"><input {...field("contract_number")} className={inputClass} required /></Field>
          <Field label="Cliente"><input {...field("client_name")} className={inputClass} required /></Field>
          <Field label="Data do contrato"><input {...field("contract_date")} type="date" className={inputClass} /></Field>
          <Field label="Prazo">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
              <input {...field("contractual_deadline_value")} aria-label="Quantidade de dias" type="number" min={0} className={inputClass} />
              <select {...field("contractual_deadline_unit")} aria-label="Tipo de prazo" className={inputClass}>
                <option value="dias_uteis">Dias úteis</option><option value="dias_corridos">Dias corridos</option>
              </select>
            </div>
          </Field>
        </div>
        <Field label="Obra"><input {...field("work_name")} className={inputClass} required /></Field>
        <Field label="Endereço da obra"><input {...field("full_address")} className={inputClass} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cidade"><input {...field("city")} className={inputClass} /></Field>
          <Field label="UF"><input {...field("state")} className={inputClass} maxLength={2} /></Field>
          <Field label="Técnico responsável">
            <select {...field("technical_manager_profile_id")} className={inputClass}>
              <option value="">A definir</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </Field>
          <Field label="Acompanhamento">
            <select {...field("followup_profile_id")} className={inputClass}>
              <option value="">A definir</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Descrição / observações"><textarea {...field("description")} className={textareaClass} /></Field>
      </fieldset>
    </ActionForm>
  );
}
