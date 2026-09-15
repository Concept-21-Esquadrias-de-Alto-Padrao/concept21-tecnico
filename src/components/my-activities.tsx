"use client";

import { ArrowUpRight, ClipboardCheck, Clock3, Loader2, PenLine, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field, inputClass } from "@/components/action-form";
import { useMyActivities } from "@/components/my-activities-provider";
import { activityKindLabels, type MyActivity } from "@/lib/my-activities";
import { isOverdue } from "@/lib/technical-rules";
import { cn, formatDate } from "@/lib/utils";

export function MyActivities() {
  return <MyActivitiesView {...useMyActivities()} />;
}

export function MyActivitiesView({ items, loading, error, refresh }: {
  items: MyActivity[]; loading: boolean; error: string; refresh: () => void;
}) {
  const [availability, setAvailability] = useState("all");
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const visible = items.filter((item) => (availability === "all" || item.available === (availability === "available"))
    && (kind === "all" || item.kind === kind) && (!overdueOnly || isOverdue(item.dueDate))
    && normalize(`${item.title} ${item.contractNumber} ${item.workName}`).includes(normalize(query.trim())));
  const available = items.filter((item) => item.available).length;

  return <section className="min-w-0 space-y-5" aria-label="Atividades pendentes">
    <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
      <dl className="grid min-w-0 flex-1 grid-cols-3 gap-3 text-sm">
        {[ ["Pendentes", items.length], ["Disponíveis", available], ["Aguardando", items.length - available] ].map(([label, count]) => (
          <div key={label} className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-charcoal">{loading || error ? "-" : count}</dd></div>
        ))}
      </dl>
      <button type="button" onClick={refresh} disabled={loading} title="Atualizar atividades" aria-label="Atualizar atividades" className="grid size-11 flex-none place-items-center rounded-md border border-border bg-white text-charcoal hover:bg-muted disabled:opacity-50">
        <RefreshCw className={cn("size-4", loading && "animate-spin")} />
      </button>
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Buscar" className="min-w-0 sm:col-span-2"><span className="relative block"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, "pl-9")} /></span></Field>
      <Field label="Tipo" className="min-w-0"><select value={kind} onChange={(event) => setKind(event.target.value)} className={cn(inputClass, "min-w-0")}><option value="all">Todos os tipos</option>{Object.entries(activityKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Situação" className="min-w-0"><select value={availability} onChange={(event) => setAvailability(event.target.value)} className={inputClass}><option value="all">Todas as pendências</option><option value="available">Disponíveis</option><option value="waiting">Aguardando liberação</option></select></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} className="size-4" /> Somente vencidas</label>
    </div>
    {error ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      : loading ? <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando atividades...</p>
        : <>
          <p role="status" className="text-xs text-muted-foreground">{visible.length} atividade(s)</p>
          <div className="divide-y divide-border">
            {visible.map((item) => {
              const overdue = isOverdue(item.dueDate);
              const Icon = item.kind.endsWith("signature") ? PenLine : ClipboardCheck;
              return <article key={item.id} className="min-w-0 space-y-3 py-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 basis-64 gap-3"><Icon className="mt-0.5 size-4 flex-none text-accent" /><div className="min-w-0 break-words"><h2 className="text-sm font-semibold text-charcoal">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.contractNumber} · {item.workName}</p></div></div>
                  <div className="flex max-w-full flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-md bg-muted px-2 py-1 text-charcoal">{activityKindLabels[item.kind]}</span>
                    <span className={cn("rounded-md px-2 py-1", item.available ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800")}>{item.available ? "Disponível" : "Aguardando liberação"}</span>
                    {overdue ? <span className="rounded-md bg-red-50 px-2 py-1 text-red-800">Vencida</span> : null}
                    {item.blocking ? <span className="rounded-md bg-red-50 px-2 py-1 text-red-800">Bloqueante</span> : null}
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1 basis-64 break-words"><p className="text-muted-foreground">{item.nextStep}</p>{item.dueDate ? <p className={cn("mt-1 flex items-center gap-1.5 text-xs", overdue ? "text-danger" : "text-muted-foreground")}><Clock3 className="size-3.5" /> Prazo: {formatDate(item.dueDate)}</p> : null}</div>
                  <Link href={item.href} className="inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-charcoal hover:bg-muted"><span>{item.linkLabel}</span><ArrowUpRight className="size-4 flex-none" /></Link>
                </div>
              </article>;
            })}
            {!visible.length ? <div className="py-8 text-sm text-muted-foreground">{items.length ? "Nenhuma atividade encontrada com estes filtros." : "Você não possui atividades pendentes."}</div> : null}
          </div>
        </>}
  </section>;
}
