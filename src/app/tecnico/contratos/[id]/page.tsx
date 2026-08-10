import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Factory,
  FileText,
  History,
  LockKeyhole,
  PackageCheck,
  PenLine,
  Pencil,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
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
  reopenContractStageAction,
  saveStageValidationAction,
  signStageValidationAction,
  splitPieceAction,
  updatePieceCemAction,
  updatePieceMeasurementAction,
  updatePieceRegistrationAction,
  approveProdBatchFormAction,
} from "@/app/actions";
import { ActionTransitionButtons } from "@/components/action-transition-buttons";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody } from "@/components/panel";
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
import { getCurrentPermissionFlags, requireAuthenticatedProfile } from "@/lib/server-access";
import { getTechnicalContractDetailData } from "@/lib/technical-data";
import { calculateReleaseProgress, isOverdue, isStageValidationSatisfied } from "@/lib/technical-rules";
import type {
  Profile,
  TechnicalContractStageKey,
  TechnicalPiece,
  TechnicalStageValidation,
  TechnicalStageValidationParticipant,
} from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

type ContractDetailPageProps = {
  params: Promise<{ id: string }>;
};

function profileName(profiles: Array<{ id: string; name: string }>, id?: string | null) {
  return profiles.find((profile) => profile.id === id)?.name ?? "A definir";
}

function profileTitle(profile: Pick<Profile, "title">) {
  return profile.title?.trim() || "Sem cargo";
}

function hiddenContract(contractId: string) {
  return <input type="hidden" name="contract_id" value={contractId} />;
}

type StageValidationView = {
  validation: TechnicalStageValidation | null;
  participants: TechnicalStageValidationParticipant[];
  required: boolean;
  complete: boolean;
  currentParticipant: TechnicalStageValidationParticipant | null;
};

const signConfirmMessage =
  "Tem certeza que deseja confirmar? Após a confirmação, a etapa será bloqueada para você e seguirá para a próxima etapa. Para retornar será necessária autorização de um gestor ou do administrador.";

function buildStageValidationView({
  stage,
  validations,
  participants,
  currentProfileId,
}: {
  stage: TechnicalContractStageKey;
  validations: TechnicalStageValidation[];
  participants: TechnicalStageValidationParticipant[];
  currentProfileId: string;
}): StageValidationView {
  const validation = validations.find((item) => item.stage === stage) ?? null;
  const stageParticipants = participants.filter((participant) => participant.stage === stage);

  return {
    validation,
    participants: stageParticipants,
    required: Boolean(validation?.validation_required),
    complete: isStageValidationSatisfied({ validation, participants: stageParticipants }),
    currentParticipant:
      stageParticipants.find((participant) => participant.profile_id === currentProfileId) ?? null,
  };
}

function stageStatusWithValidation(baseStatus: string, validation: StageValidationView, stageComplete: boolean) {
  if (!validation.required) return baseStatus;
  if (validation.complete) return `${baseStatus} + assinada`;
  return stageComplete ? "Aguardando ciência" : baseStatus;
}

function StageValidationPanel({
  contractId,
  stage,
  title,
  profiles,
  validation,
  canManage,
  stageComplete,
  completeMessage,
  className,
}: {
  contractId: string;
  stage: TechnicalContractStageKey;
  title: string;
  profiles: Profile[];
  validation: StageValidationView;
  canManage: boolean;
  stageComplete: boolean;
  completeMessage: string;
  className?: string;
}) {
  const participantIds = validation.participants.map((participant) => participant.profile_id);
  const activeProfiles = profiles.filter((profile) => profile.status === "active");
  const signedCount = validation.participants.filter((participant) => participant.signed_at).length;
  const pendingCount = validation.participants.length - signedCount;
  const currentSigned = Boolean(validation.currentParticipant?.signed_at);
  const currentCanSign = Boolean(validation.required && stageComplete && validation.currentParticipant && !currentSigned);

  return (
    <div className={cn("rounded-md border border-border bg-white p-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal">
            <ShieldCheck className="size-4 text-accent" />
            Validação da etapa
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {validation.required
              ? `${signedCount}/${validation.participants.length} participante(s) assinaram ${title}.`
              : "A etapa não exige assinatura dos participantes."}
          </p>
        </div>
        {validation.required ? (
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1",
              validation.complete
                ? "bg-green-50 text-green-800 ring-green-200"
                : "bg-amber-50 text-amber-800 ring-amber-200",
            )}
          >
            {validation.complete ? "Validada" : `${pendingCount} pendente(s)`}
          </span>
        ) : null}
      </div>

      {canManage ? (
        <ActionForm action={saveStageValidationAction} submitLabel="Salvar validação" className="mt-3 rounded-md bg-muted/30 p-3">
          <input type="hidden" name="contract_id" value={contractId} />
          <input type="hidden" name="stage" value={stage} />
          <label className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <input name="validation_required" type="checkbox" defaultChecked={validation.required} />
            Necessária validação
          </label>
          <Field label="Participantes da etapa">
            <div className="grid gap-2 md:grid-cols-2">
              {activeProfiles.map((profile) => (
                <label
                  key={profile.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-white px-3 py-3 text-sm transition hover:border-accent/60 hover:bg-muted/40"
                >
                  <input
                    name="participant_profile_ids"
                    type="checkbox"
                    value={profile.id}
                    defaultChecked={participantIds.includes(profile.id)}
                    className="mt-1 size-4 accent-orange-600"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-charcoal">{profile.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{profileTitle(profile)}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </ActionForm>
      ) : null}

      {validation.required ? (
        <div className="mt-3 grid gap-2">
          {validation.participants.map((participant) => {
            const profile = profiles.find((item) => item.id === participant.profile_id);
            const name = profile?.name ?? "Usuário removido";
            return (
              <div
                key={participant.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                  participant.signed_at ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800",
                )}
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  {participant.signed_at ? <UserCheck className="size-4" /> : <PenLine className="size-4" />}
                  {participant.signed_at
                    ? `Assinado digitalmente por ${name}`
                    : `Aguardando assinatura de ${name}`}
                </span>
                {participant.signed_at ? (
                  <span className="text-xs">{formatDateTime(participant.signed_at)}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {validation.required && !stageComplete ? (
        <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {completeMessage}
        </p>
      ) : null}

      {currentCanSign ? (
        <ActionForm
          action={signStageValidationAction}
          submitLabel="Assinar"
          confirmMessage={signConfirmMessage}
          className="mt-3 rounded-md border border-green-200 bg-green-50 p-3"
        >
          <input type="hidden" name="contract_id" value={contractId} />
          <input type="hidden" name="stage" value={stage} />
        </ActionForm>
      ) : null}
    </div>
  );
}

function FlowStep({
  id,
  title,
  description,
  status,
  locked,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  status: string;
  locked?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className="group rounded-md border border-border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 marker:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-charcoal">{title}</h2>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                locked
                  ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                  : "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
              )}
            >
              {locked ? <LockKeyhole className="size-3" /> : null}
              {status}
            </span>
          </div>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <ChevronDown className="mt-1 size-5 flex-none text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}

function ReopenStageForm({
  contractId,
  stage,
  submitLabel,
}: {
  contractId: string;
  stage: "entrada_comercial" | "reuniao_ata";
  submitLabel: string;
}) {
  return (
    <ActionForm action={reopenContractStageAction} submitLabel={submitLabel} className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="stage" value={stage} />
      <Field label="Motivo da reabertura">
        <textarea name="reason" className={textareaClass} required />
      </Field>
    </ActionForm>
  );
}

function PieceRegistrationForm({ piece }: { piece: TechnicalPiece }) {
  return (
    <ActionForm action={updatePieceRegistrationAction} submitLabel="Salvar cadastro" className="rounded-md border border-border bg-white p-3">
      <input type="hidden" name="id" value={piece.id} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Código">
          <input name="code" className={inputClass} defaultValue={piece.code} required />
        </Field>
        <Field label="Ambiente">
          <input name="environment" className={inputClass} defaultValue={piece.environment ?? ""} />
        </Field>
        <Field label="Largura venda">
          <input name="sale_width_mm" type="number" className={inputClass} defaultValue={piece.sale_width_mm ?? ""} />
        </Field>
        <Field label="Altura venda">
          <input name="sale_height_mm" type="number" className={inputClass} defaultValue={piece.sale_height_mm ?? ""} />
        </Field>
      </div>
      <Field label="Tipo / descrição da peça">
        <input name="piece_type" className={inputClass} defaultValue={piece.piece_type ?? ""} />
      </Field>
      <Field label="Motivo do ajuste">
        <textarea name="adjustment_reason" className={textareaClass} required />
      </Field>
    </ActionForm>
  );
}

function PieceActionForms({
  piece,
  canMeasure,
  canRelease,
  canManageProds,
  className,
}: {
  piece: TechnicalPiece;
  canMeasure: boolean;
  canRelease: boolean;
  canManageProds: boolean;
  className?: string;
}) {
  if (!canMeasure && !canRelease && !canManageProds) return null;

  return (
    <div className={className ?? "grid gap-3 md:grid-cols-2 xl:grid-cols-4"}>
      {canMeasure ? (
        <ActionForm action={updatePieceMeasurementAction} submitLabel="Medir" className="rounded-md bg-muted/40 p-3">
          <input type="hidden" name="id" value={piece.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="measured_width_mm" type="number" className={inputClass} placeholder="Largura" defaultValue={piece.measured_width_mm ?? ""} />
            <input name="measured_height_mm" type="number" className={inputClass} placeholder="Altura" defaultValue={piece.measured_height_mm ?? ""} />
          </div>
        </ActionForm>
      ) : null}
      {canRelease ? (
        <ActionForm action={releasePieceAction} submitLabel="Liberar" className="rounded-md bg-muted/40 p-3">
          <input type="hidden" name="id" value={piece.id} />
          <input type="hidden" name="visit_id" value={piece.release_visit_id ?? ""} />
          <Field label="Previsão excepcional">
            <input name="exceptional_due_date" type="date" className={inputClass} />
          </Field>
        </ActionForm>
      ) : null}
      {canManageProds ? (
        <ActionForm action={updatePieceCemAction} submitLabel="Atualizar CEM" className="rounded-md bg-muted/40 p-3">
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
        <ActionForm action={splitPieceAction} submitLabel="Desdobrar" className="rounded-md bg-muted/40 p-3">
          <input type="hidden" name="id" value={piece.id} />
          <input name="suffix" className={inputClass} placeholder="A" />
        </ActionForm>
      ) : null}
    </div>
  );
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

  const authContext = await requireAuthenticatedProfile();
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
    .filter((action) => !["concluida", "cancelada"].includes(action.status))
    .sort((left, right) => String(left.due_date ?? "").localeCompare(String(right.due_date ?? "")))[0];

  const canReceiveFolder = access.isMaster || access.permissions["technical.folder.receive"];
  const canManageMeetings = access.isMaster || access.permissions["technical.meetings.manage"];
  const canManageActions = access.isMaster || access.permissions["technical.actions.manage"];
  const canValidateActions = access.isMaster || access.permissions["technical.actions.reopen"];
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
  const canReopenStages = access.isMaster || access.permissions["technical.contracts.edit"];
  const canEditPieceRegistration = access.isMaster || access.permissions["technical.pieces.edit_released"];
  const currentStatus = technical?.technical_status ?? "aguardando_pasta";
  const hasCommercialFolder = Boolean(technical?.commercial_folder_received);
  const completedMeetings = snapshot.meetings.filter((meeting) => meeting.status === "concluida");
  const hasCompletedMeeting = completedMeetings.length > 0;
  const activeActions = actions.filter((action) => !["concluida", "cancelada"].includes(action.status));
  const performedVisits = visits.filter((visit) =>
    ["realizada", "aguardando_relatorio", "relatorio_emitido"].includes(visit.status),
  );
  const activeCorrections = corrections.filter((correction) => !["encerrada", "cancelada"].includes(correction.status));
  const openDoubts = doubts.filter((doubt) => doubt.status === "aberta");
  const approvedOrDeliveredProds = prodBatches.filter((prod) =>
    ["aprovado", "entregue_suprimentos", "entregue_producao", "concluido"].includes(prod.status),
  );
  const allPiecesReleased = pieces.length > 0 && releaseProgress.balance === 0;
  const stageValidationFor = (stage: TechnicalContractStageKey) =>
    buildStageValidationView({
      stage,
      validations: snapshot.stageValidations,
      participants: snapshot.stageValidationParticipants,
      currentProfileId: authContext.profile.id,
    });
  const entradaValidation = stageValidationFor("entrada_comercial");
  const reuniaoValidation = stageValidationFor("reuniao_ata");
  const acoesValidation = stageValidationFor("acoes");
  const visitasValidation = stageValidationFor("visitas");
  const pecasValidation = stageValidationFor("pecas_medicoes_liberacoes");
  const correcoesValidation = stageValidationFor("correcoes");
  const prodsValidation = stageValidationFor("prods");
  const duvidasValidation = stageValidationFor("duvidas");
  const entradaReadyForNext = hasCommercialFolder && entradaValidation.complete;
  const reuniaoReadyForNext = hasCompletedMeeting && reuniaoValidation.complete && acoesValidation.complete;
  const visitasReadyForNext = visitasValidation.complete;
  const pecasReadyForNext = pecasValidation.complete;
  const canRegisterCommercialEntry = canReceiveFolder && currentStatus === "aguardando_pasta" && !hasCommercialFolder;
  const canRegisterMeeting =
    canManageMeetings &&
    entradaReadyForNext &&
    currentStatus === "aguardando_reuniao" &&
    !hasCompletedMeeting;
  const canRegisterVisit = canManageVisits && entradaReadyForNext && reuniaoReadyForNext;
  const canOperatePieces = reuniaoReadyForNext && visitasReadyForNext;
  const canCreateProdBatch = canManageProds && pecasReadyForNext;

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
              {nextAction ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Responsável: <span className="font-semibold text-charcoal">{profileName(snapshot.profiles, nextAction.responsible_profile_id)}</span>
                </p>
              ) : null}
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

      <div className="space-y-4">
        <FlowStep
          id="entrada"
          title="Entrada comercial"
          description="Pasta comercial obrigatória antes da primeira visita."
          status={stageStatusWithValidation(
            hasCommercialFolder ? "Concluída" : currentStatus === "aguardando_pasta" ? "Liberada" : "Bloqueada",
            entradaValidation,
            hasCommercialFolder,
          )}
          locked={hasCommercialFolder}
        >
          <div className="space-y-4">
            <StageValidationPanel
              contractId={id}
              stage="entrada_comercial"
              title="Entrada comercial"
              profiles={snapshot.profiles}
              validation={entradaValidation}
              canManage={canReopenStages}
              stageComplete={hasCommercialFolder}
              completeMessage="Registre a pasta comercial para liberar a assinatura dos participantes."
            />
            <div className="rounded-md border border-border bg-white p-3 text-sm">
              <p className="font-semibold text-charcoal">
                Pasta {technical?.commercial_folder_received ? "entregue" : "pendente"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Data: {formatDateTime(technical?.folder_received_at)} · Entregue por: {technical?.folder_delivered_by ?? "-"}
              </p>
            </div>
            {canRegisterCommercialEntry ? (
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
            {hasCommercialFolder ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
                Entrada comercial concluída. A etapa está travada para alteração direta.
              </div>
            ) : null}
            {hasCommercialFolder && canReopenStages ? (
              <ReopenStageForm contractId={id} stage="entrada_comercial" submitLabel="Reabrir entrada comercial" />
            ) : null}
          </div>
        </FlowStep>

        <FlowStep
          id="reuniao"
          title="Reunião e ata"
          description="A reunião de fechamento é pré-requisito do fluxo."
          status={stageStatusWithValidation(
            !entradaReadyForNext ? "Bloqueada" : hasCompletedMeeting ? "Concluída" : "Liberada",
            reuniaoValidation,
            hasCompletedMeeting,
          )}
          locked={hasCompletedMeeting}
        >
          <div className="space-y-4">
            <StageValidationPanel
              contractId={id}
              stage="reuniao_ata"
              title="Reunião e ata"
              profiles={snapshot.profiles}
              validation={reuniaoValidation}
              canManage={canReopenStages}
              stageComplete={hasCompletedMeeting}
              completeMessage="Registre a reunião e ata para liberar a assinatura dos participantes."
            />
            {!hasCommercialFolder ? (
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                Conclua a entrada comercial para liberar esta etapa.
              </div>
            ) : null}
            {hasCommercialFolder && !entradaValidation.complete ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Entrada comercial aguarda ciência de todos os participantes antes da reunião.
              </div>
            ) : null}
            {snapshot.meetings.map((meeting) => (
              <article key={meeting.id} className="rounded-md border border-border bg-white p-3 text-sm">
                <p className="font-semibold text-charcoal">{formatDate(meeting.meeting_date)} · {meeting.participants.join(", ")}</p>
                <p className="mt-2 text-muted-foreground">{meeting.summary ?? "Sem resumo."}</p>
                {meeting.decisions ? <p className="mt-2 text-muted-foreground">Decisões: {meeting.decisions}</p> : null}
              </article>
            ))}
            {canRegisterMeeting ? (
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
            {hasCompletedMeeting ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
                Reunião e ata concluídas. A etapa está travada para alteração direta.
              </div>
            ) : null}
            {hasCompletedMeeting && canReopenStages ? (
              <ReopenStageForm contractId={id} stage="reuniao_ata" submitLabel="Reabrir reunião e ata" />
            ) : null}
          </div>
        </FlowStep>
      </div>

      <FlowStep
        id="acoes"
        title="Ações"
        description="Ações da reunião e pendências de acompanhamento."
        status={stageStatusWithValidation(
          activeActions.length ? `${activeActions.length} aberta(s)` : "Concluída",
          acoesValidation,
          activeActions.length === 0,
        )}
        locked={activeActions.length === 0}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <StageValidationPanel
            contractId={id}
            stage="acoes"
            title="Ações"
            profiles={snapshot.profiles}
            validation={acoesValidation}
            canManage={canReopenStages}
            stageComplete={activeActions.length === 0}
            completeMessage="Valide e conclua as ações abertas para liberar a assinatura dos participantes."
            className="xl:col-span-2"
          />
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
                <ActionTransitionButtons action={action} canManage={canManageActions} canValidate={canValidateActions} />
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
        </div>
      </FlowStep>

      <FlowStep
        id="visitas"
        title="Visitas"
        description="Agenda, realização, relatório e vínculo com peças."
        status={stageStatusWithValidation(
          performedVisits.length
            ? `${performedVisits.length} realizada(s)`
            : visits.length
              ? `${visits.length} agendada(s)`
              : "Sem visita",
          visitasValidation,
          performedVisits.length > 0,
        )}
        locked={visitasValidation.complete || performedVisits.length > 0}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <StageValidationPanel
            contractId={id}
            stage="visitas"
            title="Visitas"
            profiles={snapshot.profiles}
            validation={visitasValidation}
            canManage={canReopenStages}
            stageComplete={performedVisits.length > 0}
            completeMessage="Registre a realização de pelo menos uma visita para liberar a assinatura dos participantes."
            className="xl:col-span-2"
          />
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
            {!hasCompletedMeeting ? (
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                Conclua a reunião e ata para liberar o agendamento de visitas.
              </div>
            ) : null}
            {hasCompletedMeeting && (!reuniaoValidation.complete || !acoesValidation.complete) ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                A reunião/ações aguardam ciência de todos os participantes antes das visitas.
              </div>
            ) : null}
          </div>
          {canRegisterVisit ? (
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
        </div>
      </FlowStep>

      <FlowStep
        id="pecas"
        title="Peças, medições e liberações"
        description="Peças recolhidas por padrão, com ajustes e ações dentro de cada item."
        status={stageStatusWithValidation(`${pieces.length} peça(s)`, pecasValidation, allPiecesReleased)}
      >
        <div className="space-y-3">
          <StageValidationPanel
            contractId={id}
            stage="pecas_medicoes_liberacoes"
            title="Peças, medições e liberações"
            profiles={snapshot.profiles}
            validation={pecasValidation}
            canManage={canReopenStages}
            stageComplete={allPiecesReleased}
            completeMessage="Libere todas as peças ativas para liberar a assinatura dos participantes."
          />
          {!visitasValidation.complete ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              A etapa de visitas aguarda ciência de todos os participantes antes das ações de peça.
            </div>
          ) : null}
          <div className="space-y-3">
            {pieces.map((piece) => (
              <details key={piece.id} className="group rounded-md border border-border bg-white">
                <summary className="grid cursor-pointer list-none gap-3 px-3 py-3 marker:hidden sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal">{piece.code}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {piece.environment ?? "Sem ambiente"} · {piece.piece_type ?? "Sem tipo"}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-charcoal">{piece.sale_width_mm ?? "-"} x {piece.sale_height_mm ?? "-"}</span>
                    <span className="ml-1">venda</span>
                  </div>
                  <StatusBadge status={piece.status} type="piece" />
                  <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>

                <div className="space-y-4 border-t border-border p-3">
                  <dl className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Venda</dt>
                      <dd className="mt-1 font-semibold text-charcoal">{piece.sale_width_mm ?? "-"} x {piece.sale_height_mm ?? "-"}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Medição</dt>
                      <dd className="mt-1 font-semibold text-charcoal">{piece.measured_width_mm ?? "-"} x {piece.measured_height_mm ?? "-"}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">CEM</dt>
                      <dd className="mt-1 font-semibold text-charcoal">{piece.cem_registered ? "Cad." : "Pendente"} / {piece.cem_checked ? "Conf." : "Pendente"}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Prazo</dt>
                      <dd className="mt-1 font-semibold text-charcoal">{formatDate(piece.exceptional_due_date ?? piece.release_due_date)}</dd>
                    </div>
                  </dl>

                  {canEditPieceRegistration ? (
                    <details className="group rounded-md border border-border bg-muted/20">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-charcoal marker:hidden">
                        <span className="inline-flex items-center gap-2">
                          <Pencil className="size-4 text-accent" />
                          Ajustar cadastro
                        </span>
                        <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-border p-3">
                        <PieceRegistrationForm piece={piece} />
                      </div>
                    </details>
                  ) : null}

                  <PieceActionForms
                    piece={piece}
                    canMeasure={canMeasure && canOperatePieces}
                    canRelease={canRelease && canOperatePieces}
                    canManageProds={canManageProds && canOperatePieces}
                  />
                </div>
              </details>
            ))}
          </div>

          <div className="hidden">
            {pieces.map((piece) => (
              <article key={piece.id} className="rounded-md border border-border bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal">{piece.code}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{piece.environment ?? "Sem ambiente"}</p>
                  </div>
                  <StatusBadge status={piece.status} type="piece" />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">Venda</dt>
                    <dd className="mt-1 font-semibold text-charcoal">
                      {piece.sale_width_mm ?? "-"} x {piece.sale_height_mm ?? "-"}
                    </dd>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">Medição</dt>
                    <dd className="mt-1 font-semibold text-charcoal">
                      {piece.measured_width_mm ?? "-"} x {piece.measured_height_mm ?? "-"}
                    </dd>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">CEM</dt>
                    <dd className="mt-1 font-semibold text-charcoal">
                      {piece.cem_registered ? "Cad." : "Pendente"} / {piece.cem_checked ? "Conf." : "Pendente"}
                    </dd>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">Prazo</dt>
                    <dd className="mt-1 font-semibold text-charcoal">
                      {formatDate(piece.exceptional_due_date ?? piece.release_due_date)}
                    </dd>
                  </div>
                </dl>

                <PieceActionForms
                  piece={piece}
                  canMeasure={canMeasure && canOperatePieces}
                  canRelease={canRelease && canOperatePieces}
                  canManageProds={canManageProds && canOperatePieces}
                  className="mt-3 grid gap-2"
                />
              </article>
            ))}
          </div>

          <div className="hidden">
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
                      <PieceActionForms
                        piece={piece}
                        canMeasure={canMeasure && canOperatePieces}
                        canRelease={canRelease && canOperatePieces}
                        canManageProds={canManageProds && canOperatePieces}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FlowStep>

      <FlowStep
        id="correcoes"
        title="Correções"
        status={stageStatusWithValidation(
          activeCorrections.length ? `${activeCorrections.length} aberta(s)` : "Concluída",
          correcoesValidation,
          activeCorrections.length === 0,
        )}
        locked={activeCorrections.length === 0}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <StageValidationPanel
            contractId={id}
            stage="correcoes"
            title="Correções"
            profiles={snapshot.profiles}
            validation={correcoesValidation}
            canManage={canReopenStages}
            stageComplete={activeCorrections.length === 0}
            completeMessage="Encerre ou cancele as correções abertas para liberar a assinatura dos participantes."
            className="xl:col-span-2"
          />
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
        </div>
      </FlowStep>

      <FlowStep
        id="prods"
        title="PRODs, documentos e confirmações"
        status={stageStatusWithValidation(
          approvedOrDeliveredProds.length
            ? `${approvedOrDeliveredProds.length} aprovado(s)/entregue(s)`
            : prodBatches.length
              ? `${prodBatches.length} ativo(s)`
              : "Sem PROD",
          prodsValidation,
          approvedOrDeliveredProds.length > 0,
        )}
        locked={prodsValidation.complete || approvedOrDeliveredProds.length > 0}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <StageValidationPanel
            contractId={id}
            stage="prods"
            title="PRODs"
            profiles={snapshot.profiles}
            validation={prodsValidation}
            canManage={canReopenStages}
            stageComplete={approvedOrDeliveredProds.length > 0}
            completeMessage="Aprove ou entregue pelo menos um PROD para liberar a assinatura dos participantes."
            className="xl:col-span-2"
          />
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
          {canManageProds && !pecasValidation.complete ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              A etapa de peças aguarda ciência de todos os participantes antes de montar PROD.
            </div>
          ) : null}
          {canCreateProdBatch ? (
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
        </div>
      </FlowStep>

      <FlowStep
        id="duvidas"
        title="Base de dúvidas"
        description="Bases separadas para Produção e Obras/Instalações."
        status={stageStatusWithValidation(
          openDoubts.length ? `${openDoubts.length} aberta(s)` : "Concluída",
          duvidasValidation,
          openDoubts.length === 0,
        )}
        locked={openDoubts.length === 0}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <StageValidationPanel
            contractId={id}
            stage="duvidas"
            title="Dúvidas"
            profiles={snapshot.profiles}
            validation={duvidasValidation}
            canManage={canReopenStages}
            stageComplete={openDoubts.length === 0}
            completeMessage="Responda ou encerre as dúvidas abertas para liberar a assinatura dos participantes."
            className="xl:col-span-2"
          />
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
        </div>
      </FlowStep>

      <FlowStep
        id="historico"
        title="Histórico e auditoria"
        description="Alterações relevantes, valores anteriores e novos."
        status={`${snapshot.auditLogs.length} registro(s)`}
      >
        <div className="space-y-3">
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
        </div>
      </FlowStep>
    </div>
  );
}
