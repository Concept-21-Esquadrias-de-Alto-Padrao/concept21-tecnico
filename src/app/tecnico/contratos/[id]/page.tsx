import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileText,
  History,
  PackageCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  cancelVisitAction,
  checkProdBatchFormAction,
  closeCorrectionFormAction,
  createCorrectionAction,
  createDoubtAction,
  createMeetingAction,
  createProdBatchAction,
  createTechnicalActionAction,
  createVisitAction,
  deliverDepartmentDocumentAction,
  generateVisitReportFormAction,
  receiveCommercialFolderAction,
  recordVisitResultAction,
  releasePieceAction,
  splitPieceAction,
  transitionTechnicalActionFormAction,
  updatePieceCemAction,
  updatePieceMeasurementAction,
  approveProdBatchFormAction,
} from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { VisitReportPdfButton } from "@/components/visit-report-pdf-button";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalContractDetailData } from "@/lib/technical-data";
import { calculateReleaseProgress, isOverdue } from "@/lib/technical-rules";
import type { TechnicalPiece } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

type ContractDetailPageProps = {
  params: Promise<{ id: string }>;
};

function profileName(profiles: Array<{ id: string; name: string }>, id?: string | null) {
  return profiles.find((profile) => profile.id === id)?.name ?? "A definir";
}

function hiddenContract(contractId: string) {
  return <input type="hidden" name="contract_id" value={contractId} />;
}

export default async function TechnicalContractDetailPage({ params }: ContractDetailPageProps) {
  const { id } = await params;
  const access = await getCurrentPermissionFlags([
    ...appNavigationPermissionKeys,
    ...TECHNICAL_PERMISSIONS,
  ]);
  if (!canAccessModule(access, MODULE_ACCESS.contracts)) {
    redirect(firstAllowedAppRoute(access) ?? "/login");
  }

  const snapshot = await getTechnicalContractDetailData(id);
  const contract = snapshot.contracts.find((item) => item.id === id);
  if (!contract) notFound();

  const technical = snapshot.technicalContracts.find((item) => item.contract_id === id) ?? null;
  const client = snapshot.clients.find((item) => item.id === contract.client_id) ?? null;
  const pieces = snapshot.pieces.filter((piece) => piece.contract_id === id && !piece.deleted_at);
  const actions = snapshot.actions.filter((action) => action.contract_id === id && !action.deleted_at);
  const visits = snapshot.visits.filter((visit) => visit.contract_id === id);
  const corrections = snapshot.corrections.filter((correction) => correction.contract_id === id && !correction.deleted_at);
  const prodBatches = snapshot.prodBatches.filter((prod) => prod.contract_id === id && !prod.deleted_at);
  const doubts = snapshot.doubts.filter((doubt) => doubt.contract_id === id);
  const releaseProgress = calculateReleaseProgress(pieces);
  const nextVisit = visits
    .filter((visit) => visit.status === "agendada")
    .sort((left, right) => left.scheduled_date.localeCompare(right.scheduled_date))[0];
  const nextAction = actions
    .filter((action) => !["concluida", "validada", "cancelada"].includes(action.status))
    .sort((left, right) => String(left.due_date ?? "").localeCompare(String(right.due_date ?? "")))[0];

  const canReceiveFolder = access.isMaster || access.permissions["technical.folder.receive"];
  const canManageMeetings = access.isMaster || access.permissions["technical.meetings.manage"];
  const canManageActions = access.isMaster || access.permissions["technical.actions.manage"];
  const canManageVisits = access.isMaster || access.permissions["technical.visits.manage"];
  const canCancelVisits = access.isMaster || access.permissions["technical.visits.cancel"];
  const canMeasure = access.isMaster || access.permissions["technical.measurements.manage"];
  const canRelease = access.isMaster || access.permissions["technical.pieces.release"];
  const canManageCorrections = access.isMaster || access.permissions["technical.corrections.manage"];
  const canManageProds = access.isMaster || access.permissions["technical.prods.manage"];
  const canCheckProds = access.isMaster || access.permissions["technical.prods.check"];
  const canApproveProds = access.isMaster || access.permissions["technical.prods.approve"];
  const canGenerateReports = access.isMaster || access.permissions["technical.reports.generate"];
  const canManageDoubts = access.isMaster || access.permissions["technical.doubts.manage"];

  const tabLinks = [
    ["#visao-geral", "Visão geral"],
    ["#entrada", "Entrada comercial"],
    ["#reuniao", "Reunião e ata"],
    ["#visitas", "Visitas"],
    ["#pecas", "Peças"],
    ["#correcoes", "Correções"],
    ["#prods", "PRODs"],
    ["#duvidas", "Dúvidas"],
    ["#historico", "Histórico"],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${contract.contract_number} · ${client?.name ?? "Cliente"}`}
        description={`${contract.work_name} · ${contract.full_address}`}
        actions={
          <Link
            href="/tecnico/contratos"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-charcoal hover:bg-muted"
          >
            <ClipboardList className="size-4" />
            Voltar
          </Link>
        }
      />

      <Panel>
        <PanelBody>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={technical?.technical_status ?? "aguardando_pasta"} type="contract" />
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                  {releaseProgress.percent}% liberado
                </span>
                <span className={technical?.risk_status === "atrasado" ? "rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200" : "rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-800 ring-1 ring-green-200"}>
                  Risco: {technical?.risk_status ?? "normal"}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Prazo</dt>
                  <dd className="mt-1 text-charcoal">
                    {technical?.contractual_deadline_value ?? "-"} {technical?.contractual_deadline_unit === "dias_corridos" ? "dias corridos" : "dias úteis"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Técnico</dt>
                  <dd className="mt-1 text-charcoal">{profileName(snapshot.profiles, technical?.technical_manager_profile_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Acompanhamento</dt>
                  <dd className="mt-1 text-charcoal">{profileName(snapshot.profiles, technical?.followup_profile_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Próxima visita</dt>
                  <dd className="mt-1 text-charcoal">{nextVisit ? formatDate(nextVisit.scheduled_date) : "Sem visita"}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold text-charcoal">Próxima ação</p>
              <p className="mt-2 text-muted-foreground">{nextAction?.title ?? "Nenhuma ação aberta."}</p>
              {nextAction?.due_date ? (
                <p className={isOverdue(nextAction.due_date) ? "mt-2 font-semibold text-danger" : "mt-2 text-muted-foreground"}>
                  Vence em {formatDate(nextAction.due_date)}
                </p>
              ) : null}
            </div>
          </div>
        </PanelBody>
        <div className="overflow-x-auto border-t border-border px-4">
          <nav className="flex min-w-max gap-1">
            {tabLinks.map(([href, label]) => (
              <a key={href} href={href} className="border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-charcoal">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </Panel>

      <section id="visao-geral" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Peças contratadas" value={releaseProgress.total} icon={PackageCheck} />
        <StatCard label="Liberadas" value={releaseProgress.released} icon={CheckCircle2} tone="success" />
        <StatCard label="Saldo" value={releaseProgress.balance} icon={AlertTriangle} tone={releaseProgress.balance ? "warning" : "success"} />
        <StatCard label="Correções abertas" value={corrections.filter((item) => !["encerrada", "cancelada"].includes(item.status)).length} icon={AlertTriangle} tone="danger" />
        <StatCard label="PRODs ativos" value={prodBatches.filter((item) => !["concluido", "cancelado"].includes(item.status)).length} icon={Factory} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel id="entrada">
          <PanelHeader title="Entrada comercial" description="Pasta comercial obrigatória antes da primeira visita." />
          <PanelBody className="space-y-4">
            <div className="rounded-md border border-border bg-white p-3 text-sm">
              <p className="font-semibold text-charcoal">
                Pasta {technical?.commercial_folder_received ? "entregue" : "pendente"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Data: {formatDateTime(technical?.folder_received_at)} · Entregue por: {technical?.folder_delivered_by ?? "-"}
              </p>
            </div>
            {canReceiveFolder ? (
              <ActionForm action={receiveCommercialFolderAction} submitLabel="Registrar pasta">
                {hiddenContract(id)}
                <Field label="Data da entrega">
                  <input name="folder_received_at" type="datetime-local" className={inputClass} required />
                </Field>
                <Field label="Responsável pela entrega">
                  <input name="folder_delivered_by" className={inputClass} required />
                </Field>
                <Field label="Observação">
                  <textarea name="technical_notes" className={textareaClass} />
                </Field>
              </ActionForm>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel id="reuniao">
          <PanelHeader title="Reunião e ata" description="A reunião de fechamento é pré-requisito do fluxo." />
          <PanelBody className="space-y-4">
            {snapshot.meetings.map((meeting) => (
              <article key={meeting.id} className="rounded-md border border-border bg-white p-3 text-sm">
                <p className="font-semibold text-charcoal">{formatDate(meeting.meeting_date)} · {meeting.participants.join(", ")}</p>
                <p className="mt-2 text-muted-foreground">{meeting.summary ?? "Sem resumo."}</p>
                {meeting.decisions ? <p className="mt-2 text-muted-foreground">Decisões: {meeting.decisions}</p> : null}
              </article>
            ))}
            {canManageMeetings ? (
              <ActionForm action={createMeetingAction} submitLabel="Registrar reunião">
                {hiddenContract(id)}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Data">
                    <input name="meeting_date" type="date" className={inputClass} required />
                  </Field>
                  <Field label="Horário">
                    <input name="meeting_time" type="time" className={inputClass} />
                  </Field>
                </div>
                <Field label="Participantes">
                  <textarea name="participants" className={textareaClass} placeholder="Um por linha ou separados por ;" required />
                </Field>
                <Field label="Resumo">
                  <textarea name="summary" className={textareaClass} />
                </Field>
                <Field label="Decisões">
                  <textarea name="decisions" className={textareaClass} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Ação bloqueante inicial">
                    <input name="create_action_title" className={inputClass} placeholder="Opcional" />
                  </Field>
                  <Field label="Prazo da ação">
                    <input name="create_action_due_date" type="date" className={inputClass} />
                  </Field>
                </div>
              </ActionForm>
            ) : null}
          </PanelBody>
        </Panel>
      </div>

      <Panel id="acoes">
        <PanelHeader title="Ações" description="Ações da reunião e pendências de acompanhamento." />
        <PanelBody className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="space-y-3">
            {actions.map((action) => (
              <article key={action.id} className="rounded-md border border-border bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-charcoal">{action.title}</p>
                    <p className="mt-1 text-muted-foreground">
                      Responsável: {profileName(snapshot.profiles, action.responsible_profile_id)} · Prazo: {formatDate(action.due_date)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PriorityBadge priority={action.priority} />
                    <StatusBadge status={action.status} type="action" />
                  </div>
                </div>
                {canManageActions ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["em_andamento", "concluida", "validada"].map((nextStatus) => (
                      <form key={nextStatus} action={transitionTechnicalActionFormAction}>
                        <input type="hidden" name="id" value={action.id} />
                        <input type="hidden" name="next_status" value={nextStatus} />
                        <button className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                          {nextStatus.replaceAll("_", " ")}
                        </button>
                      </form>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {canManageActions ? (
            <ActionForm action={createTechnicalActionAction} submitLabel="Criar ação">
              {hiddenContract(id)}
              <Field label="Título">
                <input name="title" className={inputClass} required />
              </Field>
              <Field label="Descrição">
                <textarea name="description" className={textareaClass} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Responsável">
                  <select name="responsible_profile_id" className={inputClass}>
                    <option value="">A definir</option>
                    {snapshot.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Prazo">
                  <input name="due_date" type="date" className={inputClass} />
                </Field>
                <Field label="Prioridade">
                  <select name="priority" className={inputClass} defaultValue="normal">
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </Field>
                <Field label="Etapa bloqueada">
                  <input name="blocking_stage" className={inputClass} placeholder="entrada_inicial" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                <input name="blocking" type="checkbox" className="size-4" />
                Ação bloqueante
              </label>
            </ActionForm>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel id="visitas">
        <PanelHeader title="Visitas" description="Agenda, realização, relatório e vínculo com peças." />
        <PanelBody className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="space-y-3">
            {visits.map((visit) => {
              const linkedPieces = snapshot.visitPieces
                .filter((link) => link.visit_id === visit.id)
                .map((link) => pieces.find((piece) => piece.id === link.piece_id))
                .filter((piece): piece is TechnicalPiece => Boolean(piece));
              return (
                <article key={visit.id} className="rounded-md border border-border bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-charcoal">{formatDate(visit.scheduled_date)} · {visit.visit_type}</p>
                      <p className="mt-1 text-muted-foreground">{visit.technicians.join(", ") || "Sem técnico"}</p>
                    </div>
                    <StatusBadge status={visit.status} type="visit" />
                  </div>
                  <p className="mt-2 text-muted-foreground">{visit.result_summary ?? visit.objectives.join(", ")}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Peças: {linkedPieces.map((piece) => piece.code).join(", ") || "Não vinculadas"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visit.report_snapshot ? <VisitReportPdfButton visit={visit} pieces={linkedPieces} /> : null}
                    {canGenerateReports && visit.status === "aguardando_relatorio" ? (
                      <form action={generateVisitReportFormAction}>
                        <input type="hidden" name="id" value={visit.id} />
                        <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-charcoal px-3 py-2 text-sm font-semibold text-white hover:bg-black">
                          <FileText className="size-4" />
                          Gerar relatório
                        </button>
                      </form>
                    ) : null}
                  </div>
                  {canManageVisits && visit.status === "agendada" ? (
                    <ActionForm action={recordVisitResultAction} submitLabel="Registrar realização" className="mt-3 rounded-md bg-muted/40 p-3">
                      <input type="hidden" name="id" value={visit.id} />
                      <Field label="Realizada em">
                        <input name="performed_at" type="datetime-local" className={inputClass} required />
                      </Field>
                      <Field label="Acompanhada por">
                        <input name="accompanied_by" className={inputClass} />
                      </Field>
                      <Field label="Resultado">
                        <textarea name="result_summary" className={textareaClass} required />
                      </Field>
                    </ActionForm>
                  ) : null}
                  {canCancelVisits && visit.status === "agendada" ? (
                    <ActionForm action={cancelVisitAction} submitLabel="Cancelar visita" className="mt-3 rounded-md bg-red-50 p-3">
                      <input type="hidden" name="id" value={visit.id} />
                      <Field label="Motivo do cancelamento">
                        <input name="cancel_reason" className={inputClass} required />
                      </Field>
                    </ActionForm>
                  ) : null}
                </article>
              );
            })}
          </div>
          {canManageVisits ? (
            <ActionForm action={createVisitAction} submitLabel="Agendar visita">
              {hiddenContract(id)}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo">
                  <input name="visit_type" className={inputClass} defaultValue="Medição" required />
                </Field>
                <Field label="Data">
                  <input name="scheduled_date" type="date" className={inputClass} required />
                </Field>
                <Field label="Horário">
                  <input name="scheduled_time" type="time" className={inputClass} />
                </Field>
                <Field label="Técnicos">
                  <input name="technicians" className={inputClass} required />
                </Field>
              </div>
              <Field label="Objetivos">
                <textarea name="objectives" className={textareaClass} placeholder="Um por linha ou separados por ;" required />
              </Field>
              <Field label="Peças vinculadas">
                <select name="piece_ids" multiple className="min-h-32 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-accent">
                  {pieces.map((piece) => (
                    <option key={piece.id} value={piece.id}>{piece.code} · {piece.environment ?? "Sem ambiente"}</option>
                  ))}
                </select>
              </Field>
            </ActionForm>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel id="pecas">
        <PanelHeader title="Peças, medições e liberações" />
        <PanelBody className="space-y-3">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-[1200px] w-full border-separate border-spacing-0 bg-white text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="border-b border-border px-3 py-3">Código</th>
                  <th className="border-b border-border px-3 py-3">Ambiente</th>
                  <th className="border-b border-border px-3 py-3">Venda</th>
                  <th className="border-b border-border px-3 py-3">Medição</th>
                  <th className="border-b border-border px-3 py-3">Status</th>
                  <th className="border-b border-border px-3 py-3">CEM</th>
                  <th className="border-b border-border px-3 py-3">Prazo</th>
                  <th className="border-b border-border px-3 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pieces.map((piece) => (
                  <tr key={piece.id} className="align-top">
                    <td className="border-b border-border px-3 py-3 font-semibold text-charcoal">{piece.code}</td>
                    <td className="border-b border-border px-3 py-3">{piece.environment ?? "-"}</td>
                    <td className="border-b border-border px-3 py-3">{piece.sale_width_mm ?? "-"} x {piece.sale_height_mm ?? "-"}</td>
                    <td className="border-b border-border px-3 py-3">{piece.measured_width_mm ?? "-"} x {piece.measured_height_mm ?? "-"}</td>
                    <td className="border-b border-border px-3 py-3"><StatusBadge status={piece.status} type="piece" /></td>
                    <td className="border-b border-border px-3 py-3">{piece.cem_registered ? "Cad." : "Pendente"} / {piece.cem_checked ? "Conf." : "Pendente"}</td>
                    <td className="border-b border-border px-3 py-3">{formatDate(piece.exceptional_due_date ?? piece.release_due_date)}</td>
                    <td className="border-b border-border px-3 py-3">
                      <div className="grid gap-2">
                        {canMeasure ? (
                          <ActionForm action={updatePieceMeasurementAction} submitLabel="Medir" className="rounded-md bg-muted/40 p-2">
                            <input type="hidden" name="id" value={piece.id} />
                            <div className="grid grid-cols-2 gap-2">
                              <input name="measured_width_mm" type="number" className={inputClass} placeholder="Largura" defaultValue={piece.measured_width_mm ?? ""} />
                              <input name="measured_height_mm" type="number" className={inputClass} placeholder="Altura" defaultValue={piece.measured_height_mm ?? ""} />
                            </div>
                          </ActionForm>
                        ) : null}
                        {canRelease ? (
                          <ActionForm action={releasePieceAction} submitLabel="Liberar" className="rounded-md bg-muted/40 p-2">
                            <input type="hidden" name="id" value={piece.id} />
                            <input type="hidden" name="visit_id" value={piece.release_visit_id ?? ""} />
                            <Field label="Previsão excepcional">
                              <input name="exceptional_due_date" type="date" className={inputClass} />
                            </Field>
                          </ActionForm>
                        ) : null}
                        {canManageProds ? (
                          <ActionForm action={updatePieceCemAction} submitLabel="Atualizar CEM" className="rounded-md bg-muted/40 p-2">
                            <input type="hidden" name="id" value={piece.id} />
                            <label className="flex items-center gap-2 text-xs font-semibold text-charcoal">
                              <input name="cem_registered" type="checkbox" defaultChecked={piece.cem_registered} />
                              Cadastrada
                            </label>
                            <label className="flex items-center gap-2 text-xs font-semibold text-charcoal">
                              <input name="cem_checked" type="checkbox" defaultChecked={piece.cem_checked} />
                              Conferida
                            </label>
                          </ActionForm>
                        ) : null}
                        {canMeasure ? (
                          <ActionForm action={splitPieceAction} submitLabel="Desdobrar" className="rounded-md bg-muted/40 p-2">
                            <input type="hidden" name="id" value={piece.id} />
                            <input name="suffix" className={inputClass} placeholder="A" />
                          </ActionForm>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelBody>
      </Panel>

      <Panel id="correcoes">
        <PanelHeader title="Correções" />
        <PanelBody className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="space-y-3">
            {corrections.map((correction) => (
              <article key={correction.id} className="rounded-md border border-border bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-charcoal">{correction.type}</p>
                    <p className="mt-1 text-muted-foreground">{correction.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Prazo: {formatDate(correction.due_date)} · Responsável: {profileName(snapshot.profiles, correction.responsible_profile_id)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PriorityBadge priority={correction.priority} />
                    <StatusBadge status={correction.status} type="correction" />
                  </div>
                </div>
                {canManageCorrections && !["encerrada", "cancelada"].includes(correction.status) ? (
                  <form action={closeCorrectionFormAction} className="mt-3">
                    <input type="hidden" name="id" value={correction.id} />
                    <button className="rounded-md bg-charcoal px-3 py-2 text-xs font-semibold text-white hover:bg-black">Encerrar correção</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
          {canManageCorrections ? (
            <ActionForm action={createCorrectionAction} submitLabel="Registrar correção">
              {hiddenContract(id)}
              <Field label="Peça">
                <select name="piece_id" className={inputClass}>
                  <option value="">Contrato/PROD</option>
                  {pieces.map((piece) => (
                    <option key={piece.id} value={piece.id}>{piece.code}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo">
                <input name="type" className={inputClass} required />
              </Field>
              <Field label="Descrição">
                <textarea name="description" className={textareaClass} required />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Responsável">
                  <select name="responsible_profile_id" className={inputClass}>
                    <option value="">A definir</option>
                    {snapshot.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Prazo">
                  <input name="due_date" type="date" className={inputClass} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                <input name="blocking" type="checkbox" />
                Bloqueante
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                <input name="critical" type="checkbox" />
                Crítica
              </label>
            </ActionForm>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel id="prods">
        <PanelHeader title="PRODs, documentos e confirmações" />
        <PanelBody className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="space-y-3">
            {prodBatches.map((prod) => {
              const batchPieceIds = snapshot.prodBatchPieces.filter((link) => link.prod_batch_id === prod.id).map((link) => link.piece_id);
              const batchPieces = pieces.filter((piece) => batchPieceIds.includes(piece.id));
              const deliveries = snapshot.deliveries.filter((delivery) => delivery.prod_batch_id === prod.id);
              return (
                <article key={prod.id} className="rounded-md border border-border bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-charcoal">PROD {prod.batch_number}</p>
                      <p className="mt-1 text-muted-foreground">{batchPieces.map((piece) => piece.code).join(", ") || "Sem peças"}</p>
                    </div>
                    <StatusBadge status={prod.status} type="prod" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canCheckProds && prod.status === "aguardando_conferencia" ? (
                      <form action={checkProdBatchFormAction}>
                        <input type="hidden" name="id" value={prod.id} />
                        <button className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold hover:bg-muted">Conferir</button>
                      </form>
                    ) : null}
                    {canApproveProds && prod.status === "aguardando_aprovacao" ? (
                      <form action={approveProdBatchFormAction}>
                        <input type="hidden" name="id" value={prod.id} />
                        <button className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-orange-500">Aprovar</button>
                      </form>
                    ) : null}
                  </div>
                  {canManageProds && prod.status === "aprovado" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <ActionForm action={deliverDepartmentDocumentAction} submitLabel="Entregar lista">
                        <input type="hidden" name="prod_batch_id" value={prod.id} />
                        <input type="hidden" name="department" value="suprimentos" />
                        <input type="hidden" name="delivery_type" value="lista_materiais" />
                      </ActionForm>
                      <ActionForm action={deliverDepartmentDocumentAction} submitLabel="Entregar ordem">
                        <input type="hidden" name="prod_batch_id" value={prod.id} />
                        <input type="hidden" name="department" value="producao" />
                        <input type="hidden" name="delivery_type" value="ordem_producao" />
                      </ActionForm>
                    </div>
                  ) : null}
                  {deliveries.length ? (
                    <div className="mt-3 grid gap-2">
                      {deliveries.map((delivery) => (
                        <p key={delivery.id} className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                          {delivery.delivery_type} · {delivery.department} · {delivery.status}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          {canManageProds ? (
            <ActionForm action={createProdBatchAction} submitLabel="Montar PROD">
              {hiddenContract(id)}
              <Field label="Número do PROD">
                <input name="batch_number" className={inputClass} required />
              </Field>
              <Field label="Descrição">
                <textarea name="description" className={textareaClass} />
              </Field>
              <Field label="Peças liberadas e conferidas no CEM">
                <select name="piece_ids" multiple className="min-h-48 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-accent">
                  {pieces
                    .filter((piece) => piece.status === "liberada" && piece.cem_registered && piece.cem_checked && !piece.active_prod_batch_id)
                    .map((piece) => (
                      <option key={piece.id} value={piece.id}>{piece.code} · {piece.environment ?? "Sem ambiente"}</option>
                    ))}
                </select>
              </Field>
            </ActionForm>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel id="duvidas">
        <PanelHeader title="Base de dúvidas" description="Bases separadas para Produção e Obras/Instalações." />
        <PanelBody className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="grid gap-3">
            {(["producao", "obras_instalacoes"] as const).map((area) => (
              <div key={area} className="rounded-md border border-border bg-white p-3">
                <h3 className="font-semibold text-charcoal">{area === "producao" ? "Dúvidas da Produção" : "Dúvidas de Obras/Instalações"}</h3>
                <div className="mt-3 space-y-2">
                  {doubts.filter((doubt) => doubt.area === area).map((doubt) => (
                    <article key={doubt.id} className="rounded-md bg-muted/50 p-3 text-sm">
                      <p className="font-medium text-charcoal">{doubt.question}</p>
                      <p className="mt-1 text-muted-foreground">{doubt.answer ?? "Sem resposta."}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {canManageDoubts ? (
            <ActionForm action={createDoubtAction} submitLabel="Registrar dúvida">
              {hiddenContract(id)}
              <Field label="Base">
                <select name="area" className={inputClass}>
                  <option value="producao">Produção</option>
                  <option value="obras_instalacoes">Obras/Instalações</option>
                </select>
              </Field>
              <Field label="Categoria">
                <input name="category" className={inputClass} />
              </Field>
              <Field label="Dúvida">
                <textarea name="question" className={textareaClass} required />
              </Field>
            </ActionForm>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel id="historico">
        <PanelHeader title="Histórico e auditoria" description="Alterações relevantes, valores anteriores e novos." />
        <PanelBody className="space-y-3">
          {snapshot.auditLogs.map((log) => (
            <article key={log.id} className="rounded-md border border-border bg-white p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-charcoal">
                <History className="size-4 text-accent" />
                {log.entity} · {log.action}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.created_at)}</p>
              {log.notes ? <p className="mt-2 text-muted-foreground">{log.notes}</p> : null}
            </article>
          ))}
          {!snapshot.auditLogs.length ? <p className="text-sm text-muted-foreground">Sem histórico carregado.</p> : null}
        </PanelBody>
      </Panel>
    </div>
  );
}
