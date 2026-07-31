"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { TechnicalContractOverview } from "@/lib/types";
import { calculateReleaseProgress, isOverdue } from "@/lib/technical-rules";
import { formatDate, normalizeText } from "@/lib/utils";

export function TechnicalContractsTable({
  overviews,
}: {
  overviews: TechnicalContractOverview[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return overviews
      .filter((overview) => {
        const text = normalizeText(
          [
            overview.contract.contract_number,
            overview.client?.name,
            overview.contract.full_address,
            overview.contract.work_name,
          ]
            .filter(Boolean)
            .join(" "),
        );
        return (!normalized || text.includes(normalized)) && (!status || overview.technical?.technical_status === status);
      })
      .sort((left, right) => left.contract.contract_number.localeCompare(right.contract.contract_number));
  }, [overviews, query, status]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por número, cliente ou endereço"
            className="min-h-11 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="min-h-11 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-accent"
        >
          <option value="">Todas as situações</option>
          <option value="aguardando_pasta">Aguardando pasta</option>
          <option value="aguardando_reuniao">Aguardando reunião</option>
          <option value="em_acompanhamento">Em acompanhamento</option>
          <option value="aguardando_visita">Aguardando visita</option>
          <option value="em_medicao">Em medição</option>
          <option value="em_liberacao">Em liberação</option>
          <option value="em_prod">Em PROD</option>
          <option value="repassado">Repassado</option>
          <option value="concluido">Concluído</option>
        </select>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.map((overview) => {
          const progress = calculateReleaseProgress(overview.pieces);
          const nextVisit = overview.visits
            .filter((visit) => visit.status === "agendada")
            .sort((left, right) => left.scheduled_date.localeCompare(right.scheduled_date))[0];
          const openCorrections = overview.corrections.filter(
            (correction) => !["encerrada", "cancelada"].includes(correction.status),
          );
          const pendingProds = overview.prodBatches.filter(
            (prod) => !["concluido", "cancelado"].includes(prod.status),
          );
          const risk =
            overview.technical?.risk_status === "atrasado" ||
            openCorrections.some((correction) => correction.critical) ||
            overview.actions.some((action) => isOverdue(action.due_date) && !["concluida", "validada", "cancelada"].includes(action.status));

          return (
            <article key={overview.contract.id} className="rounded-md border border-border bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-charcoal">{overview.contract.contract_number}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {overview.client?.name ?? "Cliente não vinculado"}
                  </p>
                </div>
                <StatusBadge
                  status={overview.technical?.technical_status ?? "aguardando_pasta"}
                  type="contract"
                />
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{overview.contract.work_name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{overview.contract.full_address}</p>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/50 p-2">
                  <dt className="text-muted-foreground">Próxima visita</dt>
                  <dd className="mt-1 font-semibold text-charcoal">
                    {nextVisit ? formatDate(nextVisit.scheduled_date) : "Sem visita"}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <dt className="text-muted-foreground">Peças</dt>
                  <dd className="mt-1 font-semibold text-charcoal">
                    {progress.released}/{progress.total} liberadas
                  </dd>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <dt className="text-muted-foreground">Correções</dt>
                  <dd className="mt-1 font-semibold text-charcoal">{openCorrections.length}</dd>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <dt className="text-muted-foreground">PRODs</dt>
                  <dd className="mt-1 font-semibold text-charcoal">{pendingProds.length}</dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className={risk ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-success"}>
                  {risk ? "Em risco" : "Normal"}
                </span>
                <Link
                  href={`/tecnico/contratos/${overview.contract.id}`}
                  className="inline-flex min-h-10 items-center rounded-md bg-charcoal px-3 text-xs font-semibold text-white hover:bg-black"
                >
                  Abrir
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-border md:block">
        <table className="min-w-[1100px] w-full border-separate border-spacing-0 bg-white text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-muted-foreground">
              <th className="border-b border-border px-3 py-3">Contrato</th>
              <th className="border-b border-border px-3 py-3">Cliente / obra</th>
              <th className="border-b border-border px-3 py-3">Situação</th>
              <th className="border-b border-border px-3 py-3">Próxima visita</th>
              <th className="border-b border-border px-3 py-3">Peças</th>
              <th className="border-b border-border px-3 py-3">Correções</th>
              <th className="border-b border-border px-3 py-3">PRODs</th>
              <th className="border-b border-border px-3 py-3">Risco</th>
              <th className="border-b border-border px-3 py-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((overview) => {
              const progress = calculateReleaseProgress(overview.pieces);
              const nextVisit = overview.visits
                .filter((visit) => visit.status === "agendada")
                .sort((left, right) => left.scheduled_date.localeCompare(right.scheduled_date))[0];
              const openCorrections = overview.corrections.filter(
                (correction) => !["encerrada", "cancelada"].includes(correction.status),
              );
              const pendingProds = overview.prodBatches.filter(
                (prod) => !["concluido", "cancelado"].includes(prod.status),
              );
              const risk =
                overview.technical?.risk_status === "atrasado" ||
                openCorrections.some((correction) => correction.critical) ||
                overview.actions.some((action) => isOverdue(action.due_date) && !["concluida", "validada", "cancelada"].includes(action.status));

              return (
                <tr key={overview.contract.id} className="align-top">
                  <td className="border-b border-border px-3 py-3 font-semibold text-charcoal">
                    {overview.contract.contract_number}
                  </td>
                  <td className="border-b border-border px-3 py-3">
                    <p className="font-medium text-charcoal">{overview.client?.name ?? "Cliente não vinculado"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{overview.contract.work_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{overview.contract.full_address}</p>
                  </td>
                  <td className="border-b border-border px-3 py-3">
                    <StatusBadge
                      status={overview.technical?.technical_status ?? "aguardando_pasta"}
                      type="contract"
                    />
                  </td>
                  <td className="border-b border-border px-3 py-3">
                    {nextVisit ? formatDate(nextVisit.scheduled_date) : "Sem visita"}
                  </td>
                  <td className="border-b border-border px-3 py-3">
                    <p>{progress.total} total</p>
                    <p className="text-xs text-muted-foreground">
                      {progress.released} liberadas · {progress.balance} saldo
                    </p>
                  </td>
                  <td className="border-b border-border px-3 py-3">{openCorrections.length}</td>
                  <td className="border-b border-border px-3 py-3">{pendingProds.length}</td>
                  <td className="border-b border-border px-3 py-3">
                    <span className={risk ? "font-semibold text-danger" : "text-success"}>
                      {risk ? "Em risco" : "Normal"}
                    </span>
                  </td>
                  <td className="border-b border-border px-3 py-3">
                    <Link
                      href={`/tecnico/contratos/${overview.contract.id}`}
                      className="inline-flex rounded-md bg-charcoal px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} contrato(s) no recorte.</p>
    </div>
  );
}
