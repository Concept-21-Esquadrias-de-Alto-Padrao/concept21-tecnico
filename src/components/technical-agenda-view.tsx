"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilterX,
  List,
  MapPin,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cancelVisitAction, generateVisitReportFormAction, recordVisitResultAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { VisitReportPdfButton } from "@/components/visit-report-pdf-button";
import { technicalVisitStatusLabels } from "@/lib/labels";
import {
  addCalendarMonths,
  buildCalendarMonth,
  formatCalendarMonth,
  getInitialCalendarDate,
  getInitialCalendarMonth,
} from "@/lib/technical-calendar";
import type {
  ProductionContract,
  TechnicalPiece,
  TechnicalVisit,
  TechnicalVisitPiece,
  TechnicalVisitStatus,
} from "@/lib/types";
import { cn, formatDate, normalizeText } from "@/lib/utils";

type TechnicalAgendaViewProps = {
  visits: TechnicalVisit[];
  contracts: Array<Pick<ProductionContract, "id" | "contract_number" | "work_name" | "full_address">>;
  pieces: TechnicalPiece[];
  visitPieces: TechnicalVisitPiece[];
  todayIso: string;
  canManage: boolean;
  canCancel: boolean;
  canReport: boolean;
  initialViewMode?: AgendaViewMode;
};

type AgendaViewMode = "list" | "calendar";

const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const calendarEventTone: Record<TechnicalVisitStatus, string> = {
  agendada: "border-cyan-200 bg-cyan-50 text-cyan-900",
  realizada: "border-blue-200 bg-blue-50 text-blue-900",
  aguardando_relatorio: "border-orange-200 bg-orange-50 text-orange-900",
  relatorio_emitido: "border-green-200 bg-green-50 text-green-900",
  cancelada: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

const calendarDotTone: Record<TechnicalVisitStatus, string> = {
  agendada: "bg-cyan-500",
  realizada: "bg-blue-500",
  aguardando_relatorio: "bg-orange-500",
  relatorio_emitido: "bg-green-600",
  cancelada: "bg-zinc-400",
};

function formatVisitTime(value: string | null) {
  return value ? value.slice(0, 5) : "A definir";
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function sortVisits(visits: TechnicalVisit[]) {
  return [...visits].sort((left, right) => {
    const byDate = left.scheduled_date.localeCompare(right.scheduled_date);
    if (byDate) return byDate;
    return (left.scheduled_time ?? "99:99").localeCompare(right.scheduled_time ?? "99:99");
  });
}

function VisitCard({
  visit,
  contract,
  linkedPieces,
  canManage,
  canCancel,
  canReport,
}: {
  visit: TechnicalVisit;
  contract?: Pick<ProductionContract, "id" | "contract_number" | "work_name" | "full_address">;
  linkedPieces: TechnicalPiece[];
  canManage: boolean;
  canCancel: boolean;
  canReport: boolean;
}) {
  return (
    <article className="rounded-md border border-border bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/tecnico/contratos/${visit.contract_id}`}
            className="font-semibold text-charcoal hover:text-accent"
          >
            {contract?.contract_number ?? "Contrato"} · {contract?.work_name ?? "Obra não identificada"}
          </Link>
          <p className="mt-1 font-medium text-muted-foreground">
            {formatDate(visit.scheduled_date)} · {formatVisitTime(visit.scheduled_time)} · {visit.visit_type}
          </p>
        </div>
        <StatusBadge status={visit.status} type="visit" />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p className="flex min-w-0 items-start gap-2">
          <UserRound className="mt-0.5 size-3.5 shrink-0" />
          <span>{visit.technicians.join(", ") || "Técnico a definir"}</span>
        </p>
        {contract?.full_address ? (
          <p className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span>{contract.full_address}</span>
          </p>
        ) : null}
      </div>

      {visit.objectives.length ? (
        <p className="mt-3 border-l-2 border-accent pl-3 text-sm text-charcoal">
          {visit.objectives.join(" · ")}
        </p>
      ) : null}

      {linkedPieces.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Peças vinculadas: {linkedPieces.map((piece) => piece.code).join(", ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {visit.report_snapshot ? <VisitReportPdfButton visit={visit} pieces={linkedPieces} /> : null}
        {canReport && visit.status === "aguardando_relatorio" ? (
          <form action={generateVisitReportFormAction}>
            <input type="hidden" name="id" value={visit.id} />
            <button className="min-h-10 rounded-md bg-charcoal px-3 py-2 text-xs font-semibold text-white hover:bg-black">
              Gerar relatório
            </button>
          </form>
        ) : null}
      </div>

      {canManage && visit.status === "agendada" ? (
        <ActionForm
          action={recordVisitResultAction}
          submitLabel="Registrar realização"
          className="mt-4 rounded-md border border-border bg-muted/40 p-3"
        >
          <input type="hidden" name="id" value={visit.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Realizada em">
              <input name="performed_at" type="datetime-local" className={inputClass} required />
            </Field>
            <Field label="Acompanhada por">
              <input name="accompanied_by" className={inputClass} />
            </Field>
          </div>
          <Field label="Resultado">
            <textarea name="result_summary" className={textareaClass} required />
          </Field>
        </ActionForm>
      ) : null}

      {canCancel && visit.status === "agendada" ? (
        <ActionForm
          action={cancelVisitAction}
          submitLabel="Cancelar visita"
          className="mt-3 rounded-md border border-red-200 bg-red-50 p-3"
        >
          <input type="hidden" name="id" value={visit.id} />
          <Field label="Motivo">
            <input name="cancel_reason" className={inputClass} required />
          </Field>
        </ActionForm>
      ) : null}
    </article>
  );
}

export function TechnicalAgendaView({
  visits,
  contracts,
  pieces,
  visitPieces,
  todayIso,
  canManage,
  canCancel,
  canReport,
  initialViewMode = "list",
}: TechnicalAgendaViewProps) {
  const scheduledDates = useMemo(() => visits.map((visit) => visit.scheduled_date), [visits]);
  const initialMonth = useMemo(
    () => getInitialCalendarMonth(scheduledDates, todayIso),
    [scheduledDates, todayIso],
  );
  const [viewMode, setViewMode] = useState<AgendaViewMode>(initialViewMode);
  const [monthKey, setMonthKey] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(() =>
    getInitialCalendarDate(scheduledDates, initialMonth, todayIso),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<TechnicalVisitStatus | "">("");

  const contractsById = useMemo(
    () => new Map(contracts.map((contract) => [contract.id, contract])),
    [contracts],
  );
  const piecesById = useMemo(() => new Map(pieces.map((piece) => [piece.id, piece])), [pieces]);
  const linkedPiecesByVisit = useMemo(() => {
    const grouped = new Map<string, TechnicalPiece[]>();
    visitPieces.forEach((link) => {
      const piece = piecesById.get(link.piece_id);
      if (!piece) return;
      const linkedPieces = grouped.get(link.visit_id);
      if (linkedPieces) linkedPieces.push(piece);
      else grouped.set(link.visit_id, [piece]);
    });
    return grouped;
  }, [piecesById, visitPieces]);

  const technicianOptions = useMemo(
    () =>
      Array.from(new Set(visits.flatMap((visit) => visit.technicians).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
      ),
    [visits],
  );
  const typeOptions = useMemo(
    () =>
      Array.from(new Set(visits.map((visit) => visit.visit_type).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
      ),
    [visits],
  );

  const filteredVisits = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return sortVisits(
      visits.filter((visit) => {
        const contract = contractsById.get(visit.contract_id);
        const matchesSearch =
          !normalizedSearch ||
          normalizeText(
            [contract?.contract_number, contract?.work_name, contract?.full_address, visit.visit_type]
              .filter(Boolean)
              .join(" "),
          ).includes(normalizedSearch);
        const matchesTechnician = !technicianFilter || visit.technicians.includes(technicianFilter);
        const matchesType = !typeFilter || visit.visit_type === typeFilter;
        const matchesStatus = !statusFilter || visit.status === statusFilter;
        return matchesSearch && matchesTechnician && matchesType && matchesStatus;
      }),
    );
  }, [contractsById, searchTerm, statusFilter, technicianFilter, typeFilter, visits]);

  const visitsByDate = useMemo(() => {
    const grouped = new Map<string, TechnicalVisit[]>();
    filteredVisits.forEach((visit) => {
      const dayVisits = grouped.get(visit.scheduled_date);
      if (dayVisits) dayVisits.push(visit);
      else grouped.set(visit.scheduled_date, [visit]);
    });
    return grouped;
  }, [filteredVisits]);
  const calendarDays = useMemo(() => buildCalendarMonth(monthKey, todayIso), [monthKey, todayIso]);
  const selectedDayVisits = visitsByDate.get(selectedDate) ?? [];
  const monthVisitCount = filteredVisits.filter((visit) => visit.scheduled_date.startsWith(monthKey)).length;
  const hasFilters = Boolean(searchTerm || technicianFilter || typeFilter || statusFilter);

  function selectDate(date: string) {
    setSelectedDate(date);
    if (!date.startsWith(monthKey)) setMonthKey(date.slice(0, 7));
  }

  function changeMonth(nextMonth: string) {
    setMonthKey(nextMonth);
    setSelectedDate(
      getInitialCalendarDate(
        filteredVisits.map((visit) => visit.scheduled_date),
        nextMonth,
        todayIso,
      ),
    );
  }

  function clearFilters() {
    setSearchTerm("");
    setTechnicianFilter("");
    setTypeFilter("");
    setStatusFilter("");
  }

  return (
    <Panel className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-charcoal">Visitas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredVisits.length} visita(s) exibida(s)
          </p>
        </div>
        <div className="inline-flex w-fit rounded-md border border-border bg-muted p-1" role="group" aria-label="Formato da agenda">
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition",
              viewMode === "list" ? "bg-white text-charcoal shadow-sm" : "text-muted-foreground hover:text-charcoal",
            )}
          >
            <List className="size-4" />
            Lista
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "calendar"}
            onClick={() => setViewMode("calendar")}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition",
              viewMode === "calendar" ? "bg-white text-charcoal shadow-sm" : "text-muted-foreground hover:text-charcoal",
            )}
          >
            <CalendarDays className="size-4" />
            Calendário
          </button>
        </div>
      </div>

      <div className="border-b border-border bg-muted/30 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(13rem,1.5fr)_repeat(3,minmax(9rem,1fr))_auto]">
          <label className="relative block">
            <span className="sr-only">Buscar contrato ou obra</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={cn(inputClass, "pl-9")}
              placeholder="Buscar contrato ou obra"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por técnico</span>
            <select
              value={technicianFilter}
              onChange={(event) => setTechnicianFilter(event.target.value)}
              className={inputClass}
            >
              <option value="">Todos os técnicos</option>
              {technicianOptions.map((technician) => (
                <option key={technician} value={technician}>{technician}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por tipo</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClass}>
              <option value="">Todos os tipos</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por situação</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TechnicalVisitStatus | "")}
              className={inputClass}
            >
              <option value="">Todas as situações</option>
              {Object.entries(technicalVisitStatusLabels).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            title="Limpar filtros"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-charcoal transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FilterX className="size-4" />
            <span className="lg:sr-only">Limpar filtros</span>
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="space-y-3 p-4">
          {filteredVisits.map((visit) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              contract={contractsById.get(visit.contract_id)}
              linkedPieces={linkedPiecesByVisit.get(visit.id) ?? []}
              canManage={canManage}
              canCancel={canCancel}
              canReport={canReport}
            />
          ))}
          {!filteredVisits.length ? (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
              <CalendarDays className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-charcoal">Nenhuma visita encontrada.</p>
              <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou agende uma nova visita.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-charcoal">{formatCalendarMonth(monthKey)}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{monthVisitCount} visita(s) neste mês</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(addCalendarMonths(monthKey, -1))}
                title="Mês anterior"
                className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-white text-charcoal hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMonthKey(todayIso.slice(0, 7));
                  setSelectedDate(todayIso);
                }}
                className="min-h-10 rounded-md border border-border bg-white px-3 text-sm font-semibold text-charcoal hover:bg-muted"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => changeMonth(addCalendarMonths(monthKey, 1))}
                title="Próximo mês"
                className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-white text-charcoal hover:bg-muted"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-md border border-border sm:block">
            <div className="grid grid-cols-7 border-b border-border bg-muted/50">
              {weekDays.map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayVisits = visitsByDate.get(day.isoDate) ?? [];
                const selected = day.isoDate === selectedDate;
                return (
                  <div
                    key={day.isoDate}
                    className={cn(
                      "min-h-28 border-border p-2",
                      index % 7 !== 6 && "border-r",
                      index < 35 && "border-b",
                      !day.inCurrentMonth && "bg-muted/30",
                      selected && "bg-orange-50/60 ring-2 ring-inset ring-accent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectDate(day.isoDate)}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md text-xs font-semibold",
                        day.isToday
                          ? "bg-accent text-accent-foreground"
                          : day.inCurrentMonth
                            ? "text-charcoal hover:bg-muted"
                            : "text-muted-foreground hover:bg-white",
                      )}
                      aria-label={`Ver visitas de ${formatDate(day.isoDate)}`}
                    >
                      {day.dayOfMonth}
                    </button>
                    <div className="mt-1 space-y-1">
                      {dayVisits.slice(0, 3).map((visit) => {
                        const contract = contractsById.get(visit.contract_id);
                        return (
                          <button
                            key={visit.id}
                            type="button"
                            onClick={() => selectDate(day.isoDate)}
                            title={`${formatVisitTime(visit.scheduled_time)} · ${contract?.contract_number ?? "Contrato"} · ${visit.visit_type}`}
                            className={cn(
                              "block w-full truncate rounded-md border px-1.5 py-1 text-left text-[11px] font-semibold",
                              calendarEventTone[visit.status],
                            )}
                          >
                            {formatVisitTime(visit.scheduled_time)} · {contract?.contract_number ?? "Contrato"}
                          </button>
                        );
                      })}
                      {dayVisits.length > 3 ? (
                        <button
                          type="button"
                          onClick={() => selectDate(day.isoDate)}
                          className="px-1 text-[11px] font-semibold text-muted-foreground hover:text-charcoal"
                        >
                          +{dayVisits.length - 3} visita(s)
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 sm:hidden">
            <div className="grid grid-cols-7">
              {weekDays.map((day) => (
                <div key={day} className="py-2 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                  {day.slice(0, 1)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayVisits = visitsByDate.get(day.isoDate) ?? [];
                const selected = day.isoDate === selectedDate;
                return (
                  <button
                    key={day.isoDate}
                    type="button"
                    onClick={() => selectDate(day.isoDate)}
                    className={cn(
                      "flex aspect-square min-w-0 flex-col items-center justify-center rounded-md border text-xs font-semibold",
                      selected
                        ? "border-accent bg-orange-50 text-charcoal"
                        : day.inCurrentMonth
                          ? "border-border bg-white text-charcoal"
                          : "border-transparent bg-muted/30 text-muted-foreground",
                      day.isToday && !selected && "border-orange-300",
                    )}
                    aria-label={`Ver visitas de ${formatDate(day.isoDate)}`}
                  >
                    {day.dayOfMonth}
                    <span className="mt-1 flex h-1.5 gap-0.5" aria-hidden="true">
                      {dayVisits.slice(0, 3).map((visit) => (
                        <span key={visit.id} className={cn("size-1.5 rounded-full", calendarDotTone[visit.status])} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="mt-5 border-t border-border pt-4" aria-labelledby="selected-day-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 id="selected-day-heading" className="font-semibold text-charcoal">{formatLongDate(selectedDate)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{selectedDayVisits.length} visita(s) programada(s)</p>
              </div>
              {selectedDayVisits.length ? (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Clock3 className="size-4" />
                  Em ordem de horário
                </span>
              ) : null}
            </div>
            <div className="mt-3 space-y-3">
              {selectedDayVisits.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  contract={contractsById.get(visit.contract_id)}
                  linkedPieces={linkedPiecesByVisit.get(visit.id) ?? []}
                  canManage={canManage}
                  canCancel={canCancel}
                  canReport={canReport}
                />
              ))}
              {!selectedDayVisits.length ? (
                <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma visita programada para este dia.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </Panel>
  );
}
