"use client";

import { useId, useState } from "react";
import { Field, inputClass } from "@/components/action-form";

export function CommercialEntryFields({ initialContacts = [], initialDate = "", initialUnknown = false, onDirtyChange }: {
  initialDate?: string;
  initialUnknown?: boolean;
  initialContacts?: Array<{ name: string; role?: string | null; phone?: string | null }>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const prefix = useId();
  const [contacts, setContacts] = useState(() => (initialContacts.length ? initialContacts : [{ name: "", role: "", phone: "" }]).map((c, index) => ({ id: index, name: c.name, role: c.role ?? "", phone: c.phone ?? "" })));
  const [nextId, setNextId] = useState(contacts.length);
  const [unknown, setUnknown] = useState(initialUnknown);
  const [date, setDate] = useState(initialDate);
  function update(id: number, field: "name" | "role" | "phone", value: string) {
    setContacts(current => current.map(c => c.id === id ? { ...c, [field]: value } : c));
    onDirtyChange(true);
  }
  return <div className="space-y-5">
    <fieldset className="min-w-0 rounded-lg border border-border p-4">
      <legend className="px-2 text-sm font-semibold">Responsáveis autorizados pela obra</legend>
      <p className="mb-4 text-sm text-muted-foreground">Inclua as pessoas que podem aprovar definições da obra.</p>
      <div className="space-y-3">{contacts.map((contact, index) => <div key={`${prefix}-${contact.id}`} className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label={`Nome · pessoa ${index + 1}`}><input name="work_contact_name" value={contact.name} onChange={e => update(contact.id, "name", e.target.value)} className={inputClass} maxLength={150} required /></Field>
        <Field label="Responsabilidade / função"><input name="work_contact_role" value={contact.role} onChange={e => update(contact.id, "role", e.target.value)} placeholder="Ex.: proprietário, engenheiro, arquiteto" className={inputClass} maxLength={100} required /></Field>
        <Field label="Telefone / contato"><input name="work_contact_phone" value={contact.phone} onChange={e => update(contact.id, "phone", e.target.value)} className={inputClass} maxLength={100} required /></Field>
        <button type="button" disabled={contacts.length === 1} onClick={() => { setContacts(current => current.filter(c => c.id !== contact.id)); onDirtyChange(true); }} className="min-h-11 self-end rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-white disabled:opacity-40" aria-label={`Remover pessoa ${index + 1}`}>Remover</button>
      </div>)}</div>
      <button type="button" disabled={contacts.length >= 30} className="mt-3 min-h-11 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-40" onClick={() => { setContacts(current => [...current, { id: nextId, name: "", role: "", phone: "" }]); setNextId(nextId + 1); onDirtyChange(true); }}>+ Acrescentar responsável</button>
    </fieldset>
    <fieldset className="min-w-0 space-y-3 rounded-lg border border-border p-4">
      <legend className="px-2 text-sm font-semibold">Previsão de entrega comercial</legend>
      <p className="text-sm text-muted-foreground">Data em que o cliente precisa das peças instaladas. O prazo contratual após a liberação de medidas continua separado.</p>
      <Field label="Data de necessidade do cliente"><input type="date" name="commercial_delivery_date" className={inputClass} value={date} required={!unknown} disabled={unknown} onBlur={e => { setDate(e.currentTarget.value); }} onChange={e => { setDate(e.target.value); onDirtyChange(true); }} /></Field>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="delivery_date_unknown" checked={unknown} onChange={e => { setUnknown(e.target.checked); onDirtyChange(true); }} />Data de necessidade ainda não informada pelo cliente</label>
      {unknown && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Pauta para a primeira visita: Warlley alinha a necessidade com a obra; Anna registra a previsão e acompanha as liberações.</p>}
    </fieldset>
  </div>;
}
