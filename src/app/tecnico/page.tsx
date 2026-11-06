import {FolderWorkflowBoard} from "@/components/folder-workflow-board";
import {buildFolderWorkflow} from "@/lib/folder-workflow";
import { readDashboardPreview } from "@/lib/dashboard-preview";
import { readReceipt } from "@/lib/commercial-receipt";
import { releasePlan } from "@/lib/release-planning";
import { PieceForecastForm } from "@/components/piece-forecast-form";
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
  getWorkItemPermissions,
  firstAllowedAppRoute,
  MODULE_ACCESS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import {
  addDeadlineDays,
  visitRequiresReport,
} from "@/lib/technical-rules";
import { formatDate } from "@/lib/utils";
import { buildTechnicalWorkItems } from "@/lib/technical-work-items";

function formatVisitTime(value: string | null) {
  return value ? value.slice(0, 5) : "A definir";
}

export default async function TechnicalDashboardPage({ searchParams }: { searchParams?: Promise<{ fila?: string; q?: string }> }) {
  const access = await getCurrentPermissionFlags([...appNavigationPermissionKeys, "technical.visits.manage"]);
  if (!canAccessModule(access, MODULE_ACCESS.dashboard)) {
    redirect(firstAllowedAppRoute(access) ?? "/login");
  }

  const preview = await readDashboardPreview(access.isMaster);
  const snapshot = preview?.snapshot ?? await getTechnicalDashboardData();
  const folderRows=buildFolderWorkflow(snapshot);
  const workItemPermissions = getWorkItemPermissions(access);
  const workItems = buildTechnicalWorkItems(
    workItemPermissions.canViewActions ? snapshot.actions : [],
    workItemPermissions.canViewCorrections ? snapshot.corrections : [],
  );
  const overviews = buildContractOverviews(snapshot);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const tomorrow = new Date(today + "T12:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 7);
  const sevenDays = tomorrow.toISOString().slice(0, 10);
  const upcomingAgendaVisits = snapshot.visits
    .filter((visit) => visit.status === "agendada" && visit.scheduled_date >= today && visit.scheduled_date <= sevenDays)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || (a.scheduled_time ?? "24").localeCompare(b.scheduled_time ?? "24"))
    .slice(0, 8);

  const metrics = {
    waitingMeeting: overviews.filter(
      (item) =>
        (!readReceipt(item.technical?.commercial_data) || readReceipt(item.technical?.commercial_data)?.status === "completed") &&
        !["concluido", "cancelado"].includes(item.technical?.technical_status ?? "") &&
        !snapshot.meetings.some((meeting) => meeting.contract_id === item.contract.id && meeting.status === "concluida"),
    ).length,
    waitingFolder: overviews.filter(
      (item) =>
        !["concluido", "cancelado"].includes(item.technical?.technical_status ?? "") &&
        !item.technical?.commercial_folder_received &&
        snapshot.meetings.some((meeting) => meeting.contract_id === item.contract.id && meeting.status === "concluida"),
    ).length,
    openActions: workItems.filter((item) => !item.closed).length,
    visitsToday: snapshot.visits.filter((visit) => visit.scheduled_date === today && visit.status === "agendada").length,
    upcomingVisits: snapshot.visits.filter(
      (visit) => visit.scheduled_date > today && visit.scheduled_date <= sevenDays && visit.status === "agendada",
    ).length,
    visitsWaitingReport: snapshot.visits.filter(visitRequiresReport).length,

    prodsWaitingCheck: snapshot.prodBatches.filter((prod) => prod.status === "aguardando_conferencia").length,
    prodsWaitingApproval: snapshot.prodBatches.filter((prod) => prod.status === "aguardando_aprovacao").length,
    pendingConfirmations: snapshot.deliveries.filter((delivery) => delivery.status === "entregue").length,
    unansweredDoubts: snapshot.doubts.filter((doubt) => doubt.status === "aberta").length,
  };

  const rows = overviews.filter(({ technical }) =>
    !["concluido", "cancelado"].includes(technical?.technical_status ?? "")
  ).map((overview) => {
    const { contract, technical, pieces, visits, prodBatches } = overview;
    const plan = releasePlan(pieces, today);
    const total = units(plan);
    const released = units(plan.filter(i=>i.released));
    const progress = {total, released, balance:total-released, percent:total ? Math.round(100*released/total) : 0};
    const upcoming = visits.filter(v => v.status === "agendada" && v.scheduled_date >= today)
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || (a.scheduled_time ?? "24").localeCompare(b.scheduled_time ?? "24"));
    const nextVisit = upcoming[0];
    const measurement = upcoming.find(v => /\b(medicao|medicoes|medir|liberacao de medidas)\b/.test(
      (v.visit_type ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
    const unscheduled = Boolean(technical?.commercial_folder_received && released === 0 && progress.balance && !measurement);
    const work = workItems.filter(i => i.contract_id === contract.id && !i.closed && i.status !== "validada")
      .sort((a,b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || Number(b.blocking) - Number(a.blocking))[0];
    const due = work?.due_date && work.due_date.slice(0,10) < today ? work : undefined;
    const ready = units(plan.filter(i=>i.released && !i.emitted));
    const prods = prodBatches.filter(p => !p.deleted_at && p.status !== "cancelado");
    return { plan, overview, progress, nextVisit, measurement, unscheduled, work, due, ready, prods };
  }).sort((a,b) => Number(Boolean(b.due)) - Number(Boolean(a.due)) ||
    (a.due?.due_date ?? "").localeCompare(b.due?.due_date ?? "") ||
    Number(b.unscheduled) - Number(a.unscheduled) || b.ready - a.ready ||
    a.overview.contract.contract_number.localeCompare(b.overview.contract.contract_number, "pt-BR", { numeric: true }));
  const queues = [
    { key: "todas", label: "Obras em andamento", hint: "Obras ativas · filtros podem se sobrepor", items: rows },
    { key: "agendar", label: "Agendar medição", hint: "Obras sem liberação e sem medição marcada", items: rows.filter(r => r.unscheduled) },
    { key: "parcial", label: "Saldo a liberar", hint: "Obras já liberadas em parte e com saldo", items: rows.filter(r=>r.progress.released>0 && r.progress.balance>0) },
    { key: "prod", label: "A emitir PROD", hint: "Obras com peças liberadas sem PROD", items: rows.filter(r => r.ready > 0) },
    { key: "atrasos", label: "Com atividade vencida", hint: "Ações e correções em aberto", items: rows.filter(r => r.due) },
  ];
  function units(items: ReturnType<typeof releasePlan>) { return items.reduce((sum,i)=>sum+i.units,0); }
  const params = await searchParams;
  const requested = params?.fila;
  const query = (params?.q ?? "").trim();
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const queue = queues.find(q => q.key === requested) ?? queues[0];
  const visibleRows = queue.items.filter(row => normalize([row.overview.contract.contract_number, row.overview.client?.name, row.overview.contract.work_name].filter(Boolean).join(" ")).includes(normalize(query)));
  const canOpen = !preview && canAccessModule(access, MODULE_ACCESS.contracts);
  function renderRow(row: typeof rows[number]) {
    const { overview, progress, nextVisit, ready, unscheduled, due, prods } = row;
    const { contract, client, technical } = overview;
    const title = contract.contract_number + " · " + (client?.name ?? contract.work_name ?? "Cliente não informado");
    const base = "/tecnico/contratos/" + contract.id;
    const profileName = (id?: string | null) => snapshot.profiles.find(p => p.id === id)?.name;
    const action = (title: string, owner: string, target: string, date?: string | null) => ({title, owner, target, date: date?.slice(0,10)});
    const schedule = action("Agendar medição", "Obras · Agendamento", "#visitas");
    const holidays = snapshot.dashboardHolidays?.filter(h => h.company_id === technical?.company_id).map(h => ({ date: h.holiday_date }));
    const folder=folderRows.filter(r=>r.contract.id===contract.id&&r.stage!=='done').sort((a,b)=>(a.due??'9999').localeCompare(b.due??'9999'))[0];
    const issue=folder?action(folder.stage==='send'?'Encaminhar pasta dos lotes liberados':folder.stage==='receive'?'Confirmar recebimento da pasta':'Emitir PROD das peças liberadas',folder.owner,'#prods',folder.due):action('Conferir vínculo das peças com o lote','Obras · Repasse','#prods');
    function nextAction() {
      if (queue.key === "parcial") {
        const pending = row.plan.filter(i => !i.released);
        const needsDate = pending.some(i => !i.piece.forecast_date || i.replan);
        const nextDate = pending.flatMap(i => i.piece.forecast_date && !i.replan ? [i.piece.forecast_date] : []).sort()[0];
        return action(needsDate ? "Definir previsão do saldo" : row.measurement ? "Acompanhar próxima medição" : "Agendar medição do saldo", "Obras · Planejamento", needsDate ? "#visao-geral" : "#visitas", needsDate ? null : nextDate);
      }
      if (queue.key === "agendar") return schedule;
      if (queue.key === "prod") return issue;
      if (row.work) return action(row.work.title, profileName(row.work.responsible_profile_id) ?? "A atribuir", "#acoes", row.work.due_date);
      const receipt = readReceipt(technical?.commercial_data);
      if (receipt && receipt.status !== "completed") return action("Conferir recebimento do contrato", receipt.ownerName || "Comercial", "/recebimento", receipt.dueAt);
      if (!technical?.commercial_folder_received) {
        const meetingDone = snapshot.meetings.some(m => m.contract_id === contract.id && m.status === "concluida");
        return meetingDone ? action("Conferir pendências para entrega da pasta", "Comercial", "#entrada") :
          action("Realizar reunião de alinhamento", "Comercial", "/reuniao");
      }
      const report = overview.visits.find(visitRequiresReport);
      if (report) {
        const reportDate = report.performed_at && holidays ? addDeadlineDays({
          startDate: report.performed_at.slice(0,10), days: 3, unit: "dias_uteis", holidays,
        }) : null;
        return action("Registrar retorno da visita", report.technicians?.join(", ") || "Obras", "#visitas", reportDate);
      }
      if (unscheduled) return schedule;
      if (ready) return issue;
      if (nextVisit) return action("Realizar visita de " + nextVisit.visit_type, nextVisit.technicians?.join(", ") || "Obras", "#visitas", nextVisit.scheduled_date);
      const pendingDelivery = snapshot.deliveries.filter(d => d.status === "entregue" && prods.some(p => p.id === d.prod_batch_id))
        .sort((a,b) => (a.confirmation_due_at ?? "9999").localeCompare(b.confirmation_due_at ?? "9999"))[0];
      if (pendingDelivery) return action("Confirmar recebimento " + (pendingDelivery.delivery_type === "lista_materiais" ? "das listas" : "da ordem"),
        pendingDelivery.department === "suprimentos" ? "Suprimentos" : "Produção", "#prods", pendingDelivery.confirmation_due_at);
      if (prods.length) return action("Consultar andamento das PRODs", "Técnico", "#prods");
      return action("Revisar situação da obra", "A atribuir", "");
    }
    const next = nextAction();
    const inProd = units(row.plan.filter(i=>i.emitted));
    const partial = progress.released > 0 && progress.balance > 0;
    const pending = row.plan.filter(i=>!i.released);
    const dates = pending.flatMap(i=>i.piece.forecast_date && !i.replan ? [i.piece.forecast_date] : []).sort();
    const missing = units(pending.filter(i=>!i.piece.forecast_date));
    const revise = units(pending.filter(i=>i.replan));
    return <article key={contract.id} className="border-t border-border py-4" data-dashboard-row>
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_minmax(180px,1fr)_minmax(200px,1.2fr)] lg:items-center">
        <div>
          {canOpen ? <Link href={base} className="font-semibold text-charcoal hover:underline">{title} ↗</Link> : <strong>{title}</strong>}
          <div className="mt-2"><StatusBadge status={technical?.technical_status ?? "aguardando_reuniao"} type="contract" /></div>
        </div>
        <div className="space-y-1 text-sm">
          <p><strong>{progress.released}</strong> de {progress.total} peças liberadas</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={"Liberação de " + title} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-emerald-600" style={{width:progress.percent+"%"}} /></div>
          <p className="text-xs text-muted-foreground">{inProd} com PROD · {progress.balance} a liberar</p>
          {ready > 0 && <p className="text-xs font-medium text-blue-800">{ready} aguardando PROD</p>}
          {unscheduled && <p className="text-xs font-medium text-amber-800">Sem medição agendada · {progress.balance} peça(s) a liberar</p>}
          {row.measurement && progress.balance > 0 && <p className="text-xs text-green-800">Medição: {formatDate(row.measurement.scheduled_date)}</p>}
        </div>
        <div className="text-sm"><p className="font-medium">Responsável: {next.owner}</p><p className={next.date && next.date < today ? "font-medium text-red-700" : "text-muted-foreground"}>{next.date ? "Prazo: " + formatDate(next.date) : "Prazo a definir"}</p>{due && <p className="text-xs text-red-700">Atividade vencida</p>}</div>
        <div>{canOpen ? <Link href={base + next.target} className="inline-flex min-h-10 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100">{next.title} →</Link> : <span className="inline-flex min-h-10 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-900">{next.title}</span>}</div>
      </div>
      {partial && <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"><summary className="cursor-pointer py-2 font-medium">Saldo: {progress.balance} peças · {missing ? missing + " sem previsão" : dates.length ? "Próxima liberação: " + formatDate(dates[0]) : "Previsão a definir"}{revise > 0 && " · " + revise + " a reprogramar"}</summary><div className="pb-3">
        <p className="mb-1 font-semibold">Saldo a liberar · {progress.balance} de {progress.total} peças</p>{missing>0 && <p>Sem previsão: {missing} peça(s)</p>}<p className="mb-2">Já liberadas: {progress.released} de {progress.total}. A previsão não libera peças para fabricação.</p>
        {!preview && (access.isMaster || access.permissions["technical.visits.manage"]) && <PieceForecastForm contractId={contract.id} today={today} options={pending.map(i=>({id:i.piece.id,label:[i.piece.code,i.piece.environment,i.piece.piece_type].filter(Boolean).join(" · "),group:i.piece.forecast_group ?? null,date:i.piece.forecast_date ?? null,replan:i.replan}))}/>}
      </div></details>}
      {prods.length > 0 && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">{prods.length} PROD(s) vinculada(s)</summary><p className="py-2">{prods.map(p=>p.batch_number).join(" · ")}</p></details>}
    </article>;
  }
  return (
    <div className="space-y-4">
      {preview && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><strong>Homologação · Obras reais em consulta.</strong> Cópia de {new Date(preview.capturedAt).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})}. Filtros e busca disponíveis. Os lançamentos e atalhos das obras estão desabilitados nesta cópia; ela não atualiza o oficial.</p>}
      <PageHeader
        title="O que precisa avançar?"
        description="Painel Técnico · Prioridades, responsáveis e próximos passos das obras."
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

      <nav aria-label="Filtrar obras por situação" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {queues.map(q => <Link key={q.key} href={"/tecnico?fila=" + q.key + (query ? "&q=" + encodeURIComponent(query) : "")} scroll={false}
          aria-current={q.key === queue.key ? "page" : undefined}
          className={"rounded-xl border p-3 transition hover:border-orange-500 focus-visible:outline-2 " +
            (q.key === queue.key ? "border-charcoal bg-charcoal text-white" : "border-border bg-white text-charcoal")}>
          <span className="block text-sm font-semibold">{q.label}</span>
          <strong className="my-1 block text-2xl tabular-nums">{q.items.length}</strong>
          <span className="text-xs">{q.hint}</span>
        </Link>)}
      </nav>
      <div className="space-y-4">
        <Panel>
          <PanelHeader title={queue.label} description={preview ? "Cópia de consulta. Compare o andamento, o saldo e a próxima ação de cada obra." : "Abra a obra para consultar as peças ou seguir com a próxima ação."} />
          <PanelBody>
            <form action="/tecnico" className="mb-4 flex flex-wrap gap-2"><input type="hidden" name="fila" value={queue.key}/><label htmlFor="dashboard-search" className="sr-only">Buscar obra ou cliente</label><input key={query} id="dashboard-search" name="q" defaultValue={query} placeholder="Buscar número da obra ou cliente" className="min-h-11 min-w-48 flex-1 rounded-lg border px-3 text-sm"/><button type="submit" className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white">Buscar</button>{query && <Link className="px-3 py-2 text-sm underline" href={"/tecnico?fila="+queue.key}>Limpar</Link>}</form>
            <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{visibleRows.length} obra(s) nesta seleção</span><span>{visibleRows.reduce((sum,r)=>sum+r.progress.balance,0)} peças a liberar · {visibleRows.reduce((sum,r)=>sum+r.ready,0)} liberadas sem PROD</span></div>
            <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_minmax(180px,1fr)_minmax(200px,1.2fr)] gap-4 rounded-lg bg-slate-50 px-2 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 lg:grid"><span>Obra e cliente</span><span>Liberação e PROD</span><span>Responsável · Prazo</span><span>Próxima ação</span></div>
            {visibleRows.slice(0, 10).map(renderRow)}
            {visibleRows.length > 10 && <details><summary className="cursor-pointer py-3 text-sm font-semibold">Ver mais {visibleRows.length - 10} obras</summary>{visibleRows.slice(10).map(renderRow)}</details>}
            {!visibleRows.length && <p className="py-5 text-sm text-muted-foreground">Nenhuma obra nesta fila.</p>}

          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Agenda próxima" description="Visitas agendadas para os próximos sete dias." />
          <PanelBody className="space-y-3">
            {upcomingAgendaVisits.map((visit) => {
                const contract = snapshot.contracts.find((item) => item.id === visit.contract_id);
                return (
                  <article key={visit.id} className="rounded-md border border-border bg-white p-3">
                    <p className="font-semibold text-charcoal">
                      {formatDate(visit.scheduled_date)} · {formatVisitTime(visit.scheduled_time)} · {visit.visit_type}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {contract?.contract_number ?? "Contrato"} · {contract?.work_name ?? "Obra não informada"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Técnico: <span className="font-medium text-charcoal">{visit.technicians.join(", ") || "A definir"}</span>
                    </p>
                  </article>
                );
              })}
            {upcomingAgendaVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma visita agendada.</p>
            ) : null}
            <Link href="/tecnico/agenda" className="inline-block py-2 text-sm font-semibold text-charcoal underline">Abrir agenda técnica</Link>
            <div className="border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold">Últimas obras cadastradas</h3>
              {overviews.filter(item => item.technical?.created_at).sort((a, b) => b.technical!.created_at.localeCompare(a.technical!.created_at)).slice(0, 3).map(({ contract, client, technical }) =>
                <div className="flex flex-wrap justify-between gap-2 py-2 text-sm" key={contract.id}>
                  {canOpen ? <Link href={"/tecnico/contratos/" + contract.id} className="hover:underline">{contract.contract_number} · {client?.name ?? contract.work_name}</Link> :
                    <span>{contract.contract_number} · {client?.name ?? contract.work_name}</span>}
                  <span className="text-muted-foreground">{formatDate(technical?.created_at?.slice(0,10))}</span>
                </div>)}
              {!overviews.some(item => item.technical?.created_at) && <p className="text-sm text-muted-foreground">Nenhum cadastro com data disponível.</p>}
            </div>          </PanelBody>
        </Panel>
      </div>

      {!preview && <FolderWorkflowBoard rows={folderRows} compact />}
      <section aria-label="Indicadores por etapa"><h2 className="mb-3 text-lg font-semibold">Indicadores por etapa</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aguardando reunião" value={metrics.waitingMeeting} icon={CalendarDays} tone="warning" href="/tecnico/contratos" />
        <StatCard label="Aguardando pasta" value={metrics.waitingFolder} icon={FolderClock} href="/tecnico/contratos" />
        <StatCard label="Ações abertas" value={metrics.openActions} icon={AlertTriangle} tone="warning" href="/tecnico/acoes" />
        <StatCard label="Visitas hoje" value={metrics.visitsToday} icon={CalendarDays} tone="accent" href="/tecnico/agenda" />
        <StatCard label="Próximas visitas" value={metrics.upcomingVisits} icon={CalendarDays} href="/tecnico/agenda" />
        <StatCard label="Visitas aguardando relatório" value={metrics.visitsWaitingReport} icon={ClipboardList} tone="warning" href="/tecnico/agenda" />
        <StatCard label="Peças aguardando liberação" value={rows.reduce((sum,row)=>sum+row.progress.balance,0)} icon={PackageCheck} href="/tecnico/contratos" />
        <StatCard label="PRODs aguardando conferência" value={metrics.prodsWaitingCheck} icon={Factory} href="/tecnico/prods" />
        <StatCard label="PRODs aguardando aprovação" value={metrics.prodsWaitingApproval} icon={CheckCircle2} tone="accent" href="/tecnico/prods" />
        <StatCard label="Confirmações pendentes" value={metrics.pendingConfirmations} icon={PackageCheck} tone="warning" href="/tecnico/prods" />
        <StatCard label="Dúvidas sem resposta" value={metrics.unansweredDoubts} icon={FileQuestion} tone="danger" href="/tecnico/duvidas" />
      </div>

      </section>
      <p className="text-xs text-muted-foreground">
        Fonte atual: {preview ? "Cópia de consulta das obras oficiais" : snapshot.source === "empty" ? "Supabase não configurado ou sem dados" : "Supabase"}.
      </p>
    </div>
  );
}
