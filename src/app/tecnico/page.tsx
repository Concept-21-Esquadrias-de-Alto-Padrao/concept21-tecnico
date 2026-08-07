import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileQuestion,
  FolderClock,
  PackageCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { buildContractOverviews, getTechnicalDashboardData } from "@/lib/technical-data";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import {
  calculateReleaseProgress,
  getTechnicalContractProcessOrder,
  isOverdue,
  visitRequiresReport,
} from "@/lib/technical-rules";
import { formatDate } from "@/lib/utils";

export default async function TechnicalDashboardPage() {
  const access = await getCurrentPermissionFlags(appNavigationPermissionKeys);
  if (!canAccessModule(access, MODULE_ACCESS.dashboard)) {
    redirect(firstAllowedAppRoute(access) ?? "/login");
  }

  const snapshot = await getTechnicalDashboardData();
  const overviews = buildContractOverviews(snapshot);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);
  const sevenDays = tomorrow.toISOString().slice(0, 10);

  const metrics = {
    waitingFolder: overviews.filter((item) => !item.technical?.commercial_folder_received).length,
    waitingMeeting: overviews.filter(
      (item) =>
        item.technical?.commercial_folder_received &&
        !snapshot.meetings.some((meeting) => meeting.contract_id === item.contract.id && meeting.status === "concluida"),
    ).length,
    openActions: snapshot.actions.filter(
      (action) => !action.deleted_at && !["concluida", "cancelada"].includes(action.status),
    ).length,
    visitsToday: snapshot.visits.filter((visit) => visit.scheduled_date === today && visit.status === "agendada").length,
    upcomingVisits: snapshot.visits.filter(
      (visit) => visit.scheduled_date > today && visit.scheduled_date <= sevenDays && visit.status === "agendada",
    ).length,
    visitsWaitingReport: snapshot.visits.filter(visitRequiresReport).length,
    piecesWaitingRelease: snapshot.pieces.filter((piece) => ["avaliada", "medida"].includes(piece.status)).length,
    correctionsOpen: snapshot.corrections.filter((correction) => !["encerrada", "cancelada"].includes(correction.status)).length,
    criticalCorrections: snapshot.corrections.filter(
      (correction) => correction.critical && !["encerrada", "cancelada"].includes(correction.status),
    ).length,
    prodsWaitingCheck: snapshot.prodBatches.filter((prod) => prod.status === "aguardando_conferencia").length,
    prodsWaitingApproval: snapshot.prodBatches.filter((prod) => prod.status === "aguardando_aprovacao").length,
    pendingConfirmations: snapshot.deliveries.filter((delivery) => delivery.status === "entregue").length,
    unansweredDoubts: snapshot.doubts.filter((doubt) => doubt.status === "aberta").length,
  };

  const priorityContracts = overviews
    .map((overview) => {
      const progress = calculateReleaseProgress(overview.pieces);
      const overdueAction = overview.actions.find(
        (action) => isOverdue(action.due_date) && !["concluida", "cancelada"].includes(action.status),
      );
      const criticalCorrection = overview.corrections.find(
        (correction) => correction.critical && !["encerrada", "cancelada"].includes(correction.status),
      );
      const reason =
        overdueAction?.title ??
        criticalCorrection?.description ??
        (progress.balance > 0 ? `${progress.balance} peça(s) a liberar` : null);
      return reason
        ? {
            overview,
            progress,
            reason,
            dueDate: overdueAction?.due_date ?? criticalCorrection?.due_date ?? "9999-12-31",
            processOrder: getTechnicalContractProcessOrder(overview.technical?.technical_status),
            urgencyOrder: overdueAction ? 0 : criticalCorrection ? 1 : 2,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort(
      (left, right) =>
        left.processOrder - right.processOrder ||
        left.urgencyOrder - right.urgencyOrder ||
        left.dueDate.localeCompare(right.dueDate) ||
        left.overview.contract.contract_number.localeCompare(right.overview.contract.contract_number, "pt-BR", {
          numeric: true,
          sensitivity: "base",
        }),
    )
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel Técnico"
        description="Visão operacional do recebimento do contrato até o repasse das listas a Suprimentos e ordens à Produção."
        actions={
          <Link
            href="/tecnico/contratos"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500"
          >
            <ClipboardList className="size-4" />
            Abrir contratos
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aguardando pasta" value={metrics.waitingFolder} icon={FolderClock} href="/tecnico/contratos" />
        <StatCard label="Aguardando reunião" value={metrics.waitingMeeting} icon={CalendarDays} tone="warning" href="/tecnico/contratos" />
        <StatCard label="Ações abertas" value={metrics.openActions} icon={AlertTriangle} tone="warning" href="/tecnico/acoes" />
        <StatCard label="Visitas hoje" value={metrics.visitsToday} icon={CalendarDays} tone="accent" href="/tecnico/agenda" />
        <StatCard label="Próximas visitas" value={metrics.upcomingVisits} icon={CalendarDays} href="/tecnico/agenda" />
        <StatCard label="Visitas aguardando relatório" value={metrics.visitsWaitingReport} icon={ClipboardList} tone="warning" href="/tecnico/agenda" />
        <StatCard label="Peças aguardando liberação" value={metrics.piecesWaitingRelease} icon={PackageCheck} href="/tecnico/contratos" />
        <StatCard label="Correções abertas" value={metrics.correctionsOpen} icon={AlertTriangle} tone={metrics.criticalCorrections ? "danger" : "neutral"} href="/tecnico/correcoes" />
        <StatCard label="PRODs aguardando conferência" value={metrics.prodsWaitingCheck} icon={Factory} href="/tecnico/prods" />
        <StatCard label="PRODs aguardando aprovação" value={metrics.prodsWaitingApproval} icon={CheckCircle2} tone="accent" href="/tecnico/prods" />
        <StatCard label="Confirmações pendentes" value={metrics.pendingConfirmations} icon={PackageCheck} tone="warning" href="/tecnico/prods" />
        <StatCard label="Dúvidas sem resposta" value={metrics.unansweredDoubts} icon={FileQuestion} tone="danger" href="/tecnico/duvidas" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <PanelHeader
            title="Atividades prioritárias"
            description="Contratos ordenados pela sequência interna: pasta, reunião, visitas, medição, liberação e PROD."
          />
          <PanelBody className="space-y-3">
            {priorityContracts.length ? (
              priorityContracts.map(({ overview, progress, reason }) => (
                <article key={overview.contract.id} className="rounded-md border border-border bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Link
                        href={`/tecnico/contratos/${overview.contract.id}`}
                        className="font-semibold text-charcoal hover:text-accent"
                      >
                        {overview.contract.contract_number} · {overview.client?.name ?? "Cliente"}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
                    </div>
                    <StatusBadge status={overview.technical?.technical_status ?? "aguardando_pasta"} type="contract" />
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{progress.percent}% liberado</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem atividades críticas no recorte atual.</p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Agenda próxima" description="Visitas agendadas para os próximos sete dias." />
          <PanelBody className="space-y-3">
            {snapshot.visits
              .filter((visit) => visit.scheduled_date >= today && visit.scheduled_date <= sevenDays)
              .slice(0, 8)
              .map((visit) => {
                const contract = snapshot.contracts.find((item) => item.id === visit.contract_id);
                return (
                  <article key={visit.id} className="rounded-md border border-border bg-white p-3">
                    <p className="font-semibold text-charcoal">{formatDate(visit.scheduled_date)} · {visit.visit_type}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {contract?.contract_number ?? "Contrato"} · {visit.technicians.join(", ") || "Sem técnico"}
                    </p>
                  </article>
                );
              })}
            {snapshot.visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma visita agendada.</p>
            ) : null}
          </PanelBody>
        </Panel>
      </div>

      <p className="text-xs text-muted-foreground">
        Fonte atual: {snapshot.source === "empty" ? "Supabase não configurado ou sem dados" : "Supabase"}.
      </p>
    </div>
  );
}
