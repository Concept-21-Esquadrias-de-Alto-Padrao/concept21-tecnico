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
  createDoubtAction,
  createMeetingAction,
  createPieceStructuralChangeAction,
  createProdBatchAction,
  createReleaseBatchAction,
  createVisitAction,
  deliverDepartmentDocumentAction,
  generateVisitReportFormAction,
  receiveCommercialFolderAction,
  recordVisitResultAction,
  reopenContractStageAction,
  saveStageValidationAction,
  signReleaseBatchAction,
  signStageValidationAction,
  splitPieceAction,
  updateContractWorkDataAction,
  updateContractResponsiblesAction,
  updatePieceCemAction,
  updatePieceMeasurementAction,
  updatePieceRegistrationAction,
  approveProdBatchFormAction,
} from "@/app/actions";
import { TechnicalActionsPanel } from "@/components/technical-actions-panel";
import { buildTechnicalWorkItems, filterTechnicalWorkItems } from "@/lib/technical-work-items";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { DeleteTechnicalContractForm } from "@/components/delete-technical-contract-form";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody } from "@/components/panel";
import { ProjectMeasurementFields } from "@/components/project-measurement-fields";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { VisitReportPdfButton } from "@/components/visit-report-pdf-button";
import { formatAuditLogEntry } from "@/lib/audit-log-format";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  getWorkItemPermissions,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags, requireAuthenticatedProfile } from "@/lib/server-access";
import { getTechnicalContractDetailData } from "@/lib/technical-data";
import { calculateReleaseProgress, isOverdue, isStageValidationSatisfied } from "@/lib/technical-rules";
import type {
  Client,
  Profile,
  ProductionContract,
  TechnicalContract,
  TechnicalContractStageKey,
  TechnicalAction,
  TechnicalPiece,
  TechnicalRelease,
  TechnicalReleaseParticipant,
  TechnicalReleasePiece,
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

function isReleaseBatchSigned(
  release: Pick<TechnicalRelease, "validation_required" | "status">,
  participants: Array<Pick<TechnicalReleaseParticipant, "signed_at">>,
) {
  if (release.status === "cancelado") return false;
  if (!release.validation_required) return true;
  if (release.status === "validado") return true;
  return participants.length > 0 && participants.every((participant) => Boolean(participant.signed_at));
}

function releaseBatchStatusLabel(
  release: Pick<TechnicalRelease, "validation_required" | "status">,
  participants: Array<Pick<TechnicalReleaseParticipant, "signed_at">>,
) {
  if (release.status === "cancelado") return "Cancelado";
  if (isReleaseBatchSigned(release, participants)) return "Validado";
  const signedCount = participants.filter((participant) => participant.signed_at).length;
  return `${participants.length - signedCount} assinatura(s) pendente(s)`;
}

const releaseBatchSignConfirmMessage =
  "Tem certeza que deseja confirmar este lote? Após a confirmação, sua assinatura ficará registrada e as peças do lote seguirão para a próxima etapa quando todos os participantes assinarem.";

function StageValidationPanel({
  contractId,
  stage,
  title,
  profiles,
  validation,
  canManage,
  stageComplete,
  completeMessage,
  signatureMode = "stage",
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
  signatureMode?: "stage" | "release_batch_config";
  className?: string;
}) {
  const isReleaseBatchConfig = signatureMode === "release_batch_config";
  const participantIds = validation.participants.map((participant) => participant.profile_id);
  const activeProfiles = profiles.filter((profile) => profile.status === "active");
  const signedCount = validation.participants.filter((participant) => participant.signed_at).length;
  const pendingCount = validation.participants.length - signedCount;
  const currentSigned = Boolean(validation.currentParticipant?.signed_at);
  const currentCanSign = Boolean(
    !isReleaseBatchConfig && validation.required && stageComplete && validation.currentParticipant && !currentSigned,
  );

  return (
    <div id={`assinatura-${stage}`} className={cn("scroll-mt-40 rounded-md border border-border bg-white p-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal">
            <ShieldCheck className="size-4 text-accent" />
            Validação da etapa
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isReleaseBatchConfig
              ? validation.required
                ? `${validation.participants.length} participante(s) serão copiados para cada lote criado.`
                : "Os lotes não exigirão assinatura dos participantes."
              : validation.required
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
            {isReleaseBatchConfig
              ? `${validation.participants.length} participante(s)`
              : validation.complete
                ? "Validada"
                : `${pendingCount} pendente(s)`}
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

      {validation.required && !isReleaseBatchConfig ? (
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

      {validation.required && !stageComplete && !isReleaseBatchConfig ? (
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
    <ActionForm
      action={reopenContractStageAction}
      submitLabel={submitLabel}
      className="rounded-md border border-amber-200 bg-amber-50 p-3"
    >
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="stage" value={stage} />
      <Field label="Motivo da reabertura">
        <textarea name="reason" className={textareaClass} required />
      </Field>
    </ActionForm>
  );
}

function WorkDataCorrectionForm({
  client,
  contract,
}: {
  client: Client | null;
  contract: ProductionContract;
}) {
  return (
    <ActionForm
      action={updateContractWorkDataAction}
      submitLabel="Salvar correção"
      className="rounded-md border border-border bg-white p-3"
      confirmMessage="Confirma a correção dos dados da obra? A alteração será registrada no histórico e auditoria do contrato."
    >
      <input type="hidden" name="id" value={contract.id} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Cliente">
          <input name="client_name" className={inputClass} defaultValue={client?.name ?? ""} required />
        </Field>
        <Field label="Obra">
          <input name="work_name" className={inputClass} defaultValue={contract.work_name} required />
        </Field>
        <Field label="Endereço da obra">
          <input name="full_address" className={inputClass} defaultValue={contract.full_address} required />
        </Field>
        <Field label="Cidade">
          <input name="city" className={inputClass} defaultValue={contract.city} required />
        </Field>
        <Field label="UF">
          <input name="state" className={inputClass} defaultValue={contract.state} maxLength={2} required />
        </Field>
        <Field label="CEP">
          <input name="zip_code" className={inputClass} defaultValue={contract.zip_code ?? ""} />
        </Field>
        <Field label="Contato da obra">
          <input name="site_contact" className={inputClass} defaultValue={contract.site_contact ?? ""} />
        </Field>
        <Field label="Telefone do contato">
          <input
            name="site_contact_phone"
            className={inputClass}
            defaultValue={contract.site_contact_phone ?? ""}
          />
        </Field>
      </div>
      <Field label="Observações">
        <textarea name="notes" className={textareaClass} defaultValue={contract.notes ?? ""} />
      </Field>
      <Field label="Motivo da correção">
        <textarea
          name="adjustment_reason"
          className={textareaClass}
          placeholder="Ex.: corrigir endereço lido incorretamente no PDF."
          required
        />
      </Field>
    </ActionForm>
  );
}

function ContractResponsiblesForm({
  contract,
  profiles,
}: {
  contract: TechnicalContract;
  profiles: Profile[];
}) {
  const availableProfiles = profiles.filter((profile) => profile.status !== "inactive");
  return (
    <ActionForm
      action={updateContractResponsiblesAction}
      submitLabel="Salvar responsáveis"
      className="rounded-md border border-border bg-white p-3"
      confirmMessage="Confirma a alteração dos responsáveis? A mudança será registrada no histórico e não alterará ações, participantes ou assinaturas existentes."
    >
      <input type="hidden" name="contract_id" value={contract.contract_id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Técnico responsável">
          <select name="technical_manager_profile_id" className={inputClass} defaultValue={contract.technical_manager_profile_id ?? ""}>
            <option value="">A definir</option>
            {availableProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name} · {profileTitle(profile)}</option>
            ))}
          </select>
        </Field>
        <Field label="Acompanhamento">
          <select name="followup_profile_id" className={inputClass} defaultValue={contract.followup_profile_id ?? ""}>
            <option value="">A definir</option>
            {availableProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name} · {profileTitle(profile)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Motivo da alteração">
        <textarea
          name="adjustment_reason"
          className={textareaClass}
          placeholder="Ex.: definição do técnico responsável após o cadastro."
          required
        />
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

function ContractPiecesSummary({
  pieces,
  canEditRegistration,
}: {
  pieces: TechnicalPiece[];
  canEditRegistration: boolean;
}) {
  return (
    <section className="min-w-0 space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-charcoal">Peças do contrato</h3>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            Cadastro-base recebido do Comercial. As etapas seguintes confirmam e atualizam estas mesmas peças.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200">
            {pieces.length} peça(s)
          </span>
          <a href="#pecas" className="text-sm font-semibold text-accent hover:underline">
            Ir para medições e liberações
          </a>
        </div>
      </div>

      {pieces.length ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-[760px] w-full border-separate border-spacing-0 bg-white text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted-foreground">
                <th className="border-b border-border px-3 py-3">Código</th>
                <th className="border-b border-border px-3 py-3">Ambiente</th>
                <th className="border-b border-border px-3 py-3">Tipo</th>
                <th className="border-b border-border px-3 py-3">Medidas de venda</th>
                <th className="border-b border-border px-3 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((piece) => (
                <tr key={piece.id} className="align-top last:[&>td]:border-b-0">
                  <td className="border-b border-border px-3 py-3 font-semibold text-charcoal">{piece.code}</td>
                  <td className="border-b border-border px-3 py-3">{piece.environment ?? "Sem ambiente"}</td>
                  <td className="max-w-md border-b border-border px-3 py-3 text-muted-foreground">{piece.piece_type ?? "Sem tipo"}</td>
                  <td className="border-b border-border px-3 py-3 whitespace-nowrap">{piece.sale_width_mm ?? "-"} x {piece.sale_height_mm ?? "-"} mm</td>
                  <td className="border-b border-border px-3 py-3"><StatusBadge status={piece.status} type="piece" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhuma peça cadastrada neste contrato.
        </div>
      )}

      {canEditRegistration && pieces.length ? (
        <details className="group rounded-md border border-border bg-muted/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-charcoal marker:hidden">
            <span className="inline-flex items-center gap-2"><Pencil className="size-4 text-accent" /> Corrigir cadastro-base</span>
            <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t border-border p-3">
            <p className="text-xs text-muted-foreground">
              Use esta área somente para corrigir erro de cadastro ou importação. Mudanças estruturais encontradas em campo devem ser registradas como ação.
            </p>
            {pieces.map((piece) => (
              <details key={piece.id} className="group rounded-md border border-border bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm marker:hidden">
                  <span><strong className="text-charcoal">{piece.code}</strong> · {piece.environment ?? "Sem ambiente"}</span>
                  <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-border p-3"><PieceRegistrationForm piece={piece} /></div>
              </details>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function StructuralChangeActionForm({ piece, profiles }: { piece: TechnicalPiece; profiles: Profile[] }) {
  return (
    <details className="group rounded-md border border-amber-200 bg-amber-50/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-amber-900 marker:hidden">
        <span className="inline-flex items-center gap-2"><AlertTriangle className="size-4" /> Registrar alteração estrutural</span>
        <ChevronDown className="size-4 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-amber-200 p-3">
        <p className="mb-3 text-xs text-amber-900">
          Use quando a mudança afetar a estrutura da peça e puder gerar crédito ou cobrança. A liberação desta peça ficará bloqueada até a ação ser concluída.
        </p>
        <ActionForm
          action={createPieceStructuralChangeAction}
          submitLabel="Registrar ação estrutural"
          confirmMessage="Confirma o registro? A liberação desta peça ficará bloqueada até a conclusão da ação."
          className="bg-transparent p-0 shadow-none"
        >
          <input type="hidden" name="piece_id" value={piece.id} />
          <Field label="Alteração identificada">
            <textarea name="description" className={textareaClass} required placeholder="Descreva o que mudou na estrutura da peça." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Impacto financeiro">
              <select name="financial_impact" defaultValue="a_avaliar" className={inputClass}>
                <option value="a_avaliar">A avaliar</option>
                <option value="sem_impacto">Sem impacto</option>
                <option value="credito">Possível crédito</option>
                <option value="cobranca_adicional">Possível cobrança adicional</option>
              </select>
            </Field>
            <Field label="Valor estimado">
              <input name="financial_amount" type="number" min="0" step="0.01" className={inputClass} placeholder="R$ 0,00" />
            </Field>
            <Field label="Responsável">
              <select name="responsible_profile_id" className={inputClass} defaultValue="" required>
                <option value="">Selecione</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </Field>
            <Field label="Prazo">
              <input name="due_date" type="date" className={inputClass} />
            </Field>
          </div>
          <input type="hidden" name="priority" value="alta" />
        </ActionForm>
      </div>
    </details>
  );
}

function PieceActionForms({
  piece,
  canMeasure,
  canManageProds,
  profiles,
  structuralActions,
  className,
}: {
  piece: TechnicalPiece;
  canMeasure: boolean;
  canManageProds: boolean;
  profiles: Profile[];
  structuralActions: TechnicalAction[];
  className?: string;
}) {
  if (!canMeasure && !canManageProds) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {structuralActions.length ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Liberação bloqueada por alteração estrutural</p>
          {structuralActions.map((action) => <p key={action.id} className="mt-1">{action.title}</p>)}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {canMeasure ? (
        <ActionForm action={updatePieceMeasurementAction} submitLabel="Salvar medição" className="rounded-md bg-muted/40 p-3 xl:col-span-2">
          <input type="hidden" name="id" value={piece.id} />
          <Field label="Ambiente conferido em obra">
            <input name="environment" className={inputClass} defaultValue={piece.environment ?? ""} />
          </Field>
          <ProjectMeasurementFields projectOnly={piece.project_only} width={piece.measured_width_mm} height={piece.measured_height_mm} />
          <textarea name="notes" className={textareaClass} placeholder="Observação da medição (opcional)" defaultValue={piece.notes ?? ""} />
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
      {canMeasure ? <StructuralChangeActionForm piece={piece} profiles={profiles} /> : null}
    </div>
  );
}

function ReleaseBatchForm({
  contractId,
  pieces,
  blockingActionsByPieceId,
}: {
  contractId: string;
  pieces: TechnicalPiece[];
  blockingActionsByPieceId: Map<string, TechnicalAction[]>;
}) {
  if (!pieces.length) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
        Não há peças pendentes para novo lote de liberação.
      </div>
    );
  }

  return (
    <ActionForm
      action={createReleaseBatchAction}
      submitLabel="Criar lote de liberação"
      className="rounded-md border border-border bg-white p-3"
      confirmMessage="Confirma a criação deste lote? Somente as peças selecionadas serão liberadas para assinatura e avanço do fluxo."
    >
      <input type="hidden" name="contract_id" value={contractId} />
      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="Identificação do lote">
          <input name="batch_number" className={inputClass} placeholder="Ex.: Lote 1" />
        </Field>
        <Field label="Prazo da liberação">
          <input name="default_due_date" type="date" className={inputClass} />
        </Field>
        <Field label="Observações">
          <textarea name="notes" className={textareaClass} />
        </Field>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-charcoal">Peças deste lote</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Marque somente as peças que estão sendo liberadas agora. As demais permanecem aguardando novo lote.
          </p>
        </div>
        <div className="grid gap-2">
          {pieces.map((piece) => {
            const blockingActions = blockingActionsByPieceId.get(piece.id) ?? [];
            const blocked = blockingActions.length > 0;
            return (
            <div key={piece.id} className={cn("rounded-md border p-3", blocked ? "border-red-200 bg-red-50/60" : "border-border bg-muted/20")}>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input name="piece_ids" type="checkbox" value={piece.id} className="mt-1 size-4 accent-orange-600" disabled={blocked} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-charcoal">{piece.code}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {piece.environment ?? "Sem ambiente"} · {piece.piece_type ?? "Sem tipo"}
                  </span>
                </span>
                <StatusBadge status={piece.status} type="piece" />
              </label>
              {blocked ? (
                <p className="mt-2 text-xs font-semibold text-red-800">
                  Liberação bloqueada até a conclusão da ação estrutural.
                </p>
              ) : null}
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Ambiente</span>
                  <input
                    name={`environment_${piece.id}`}
                    className={inputClass}
                    defaultValue={piece.environment ?? ""}
                    placeholder="Ambiente correto"
                  />
                </label>
                <ProjectMeasurementFields
                  nameSuffix={`_${piece.id}`}
                  projectOnly={piece.project_only}
                  width={piece.measured_width_mm}
                  height={piece.measured_height_mm}
                  placeholders={{ width: piece.sale_width_mm ? String(piece.sale_width_mm) : "Largura", height: piece.sale_height_mm ? String(piece.sale_height_mm) : "Altura" }}
                />
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </ActionForm>
  );
}

function ReleaseBatchList({
  releases,
  releasePiecesByReleaseId,
  pieces,
  participantsByReleaseId,
  profiles,
  currentProfileId,
}: {
  releases: TechnicalRelease[];
  releasePiecesByReleaseId: Map<string, TechnicalReleasePiece[]>;
  pieces: TechnicalPiece[];
  participantsByReleaseId: Map<string, TechnicalReleaseParticipant[]>;
  profiles: Profile[];
  currentProfileId: string;
}) {
  if (!releases.length) {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Nenhum lote de liberação criado ainda.
      </div>
    );
  }

  const piecesById = new Map(pieces.map((piece) => [piece.id, piece]));

  return (
    <div className="space-y-2">
      {releases.map((release) => {
        const participants = participantsByReleaseId.get(release.id) ?? [];
        const links = releasePiecesByReleaseId.get(release.id) ?? [];
        const batchPieces = links
          .map((link) => ({ link, piece: piecesById.get(link.piece_id) }))
          .filter((item): item is { link: TechnicalReleasePiece; piece: TechnicalPiece } => Boolean(item.piece));
        const signed = isReleaseBatchSigned(release, participants);
        const currentParticipant = participants.find((participant) => participant.profile_id === currentProfileId);
        const currentCanSign = Boolean(
          release.validation_required &&
            release.status !== "cancelado" &&
            currentParticipant &&
            !currentParticipant.signed_at,
        );

        return (
          <details id={`lote-${release.id}`} key={release.id} className="group scroll-mt-40 rounded-md border border-border bg-white">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-3 marker:hidden">
              <div className="min-w-0">
                <p className="font-semibold text-charcoal">{release.batch_number ?? "Lote de liberação"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {batchPieces.length || links.length} peça(s) · Liberado em {formatDate(release.release_date)}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold ring-1",
                    signed
                      ? "bg-green-50 text-green-800 ring-green-200"
                      : release.status === "cancelado"
                        ? "bg-red-50 text-red-800 ring-red-200"
                        : "bg-amber-50 text-amber-800 ring-amber-200",
                  )}
                >
                  {releaseBatchStatusLabel(release, participants)}
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
              </div>
            </summary>
            <div className="space-y-3 border-t border-border p-3 text-sm">
              <dl className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-muted/40 p-2">
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Prazo</dt>
                  <dd className="mt-1 font-semibold text-charcoal">{formatDate(release.default_due_date)}</dd>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Assinatura</dt>
                  <dd className="mt-1 font-semibold text-charcoal">
                    {release.validation_required ? "Necessária" : "Não necessária"}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Validado em</dt>
                  <dd className="mt-1 font-semibold text-charcoal">{formatDateTime(release.validated_at)}</dd>
                </div>
              </dl>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Peças do lote</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {batchPieces.map(({ piece, link }) => (
                    <span key={piece.id} className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-semibold text-charcoal">
                      {piece.code} · {piece.environment ?? "Sem ambiente"} · {link.project_only_at_release ? "Projeto" : `${piece.measured_width_mm ?? "-"} x ${piece.measured_height_mm ?? "-"}`}
                    </span>
                  ))}
                  {!batchPieces.length ? (
                    <span className="text-xs text-muted-foreground">Peças não encontradas no cadastro ativo.</span>
                  ) : null}
                </div>
              </div>

              {release.notes ? <p className="rounded-md bg-muted/30 px-3 py-2 text-muted-foreground">{release.notes}</p> : null}

              {release.validation_required ? (
                <div className="grid gap-2">
                  {participants.map((participant) => {
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
                        {participant.signed_at ? <span className="text-xs">{formatDateTime(participant.signed_at)}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  Lote validado automaticamente porque a configuração atual não exige assinatura.
                </div>
              )}

              {currentCanSign ? (
                <ActionForm
                  action={signReleaseBatchAction}
                  submitLabel="Assinar lote"
                  confirmMessage={releaseBatchSignConfirmMessage}
                  className="rounded-md border border-green-200 bg-green-50 p-3"
                >
                  <input type="hidden" name="release_id" value={release.id} />
                </ActionForm>
              ) : null}
            </div>
          </details>
        );
      })}
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
  if (!contract || !contract.active) notFound();

  const technical = snapshot.technicalContracts.find((item) => item.contract_id === id) ?? null;
  if (technical?.deleted_at) notFound();

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
  const workItemPermissions = getWorkItemPermissions(access);
  const nextAction = filterTechnicalWorkItems(buildTechnicalWorkItems(
    workItemPermissions.canViewActions ? actions : [],
    workItemPermissions.canViewCorrections ? corrections : [],
  ), { situation: "open" })[0];

  const canReceiveFolder = access.isMaster || access.permissions["technical.folder.receive"];
  const canManageMeetings = access.isMaster || access.permissions["technical.meetings.manage"];
  const canManageVisits = access.isMaster || access.permissions["technical.visits.manage"];
  const canCancelVisits = access.isMaster || access.permissions["technical.visits.cancel"];
  const canMeasure = access.isMaster || access.permissions["technical.measurements.manage"];
  const canRelease = access.isMaster || access.permissions["technical.pieces.release"];
  const canManageProds = access.isMaster || access.permissions["technical.prods.manage"];
  const canCheckProds = access.isMaster || access.permissions["technical.prods.check"];
  const canApproveProds = access.isMaster || access.permissions["technical.prods.approve"];
  const canGenerateReports = access.isMaster || access.permissions["technical.reports.generate"];
  const canManageDoubts = access.isMaster || access.permissions["technical.doubts.manage"];
  const canReopenStages = access.isMaster || access.permissions["technical.contracts.edit"];
  const canCorrectWorkData = access.isMaster || access.permissions["technical.contracts.correct_work_data"];
  const canEditResponsibles = access.isMaster || access.permissions["technical.contracts.edit"];
  const canEditPieceRegistration = access.isMaster || access.permissions["technical.pieces.edit_released"];
  const canDeleteContract = access.isMaster;
  const currentStatus = technical?.technical_status ?? "aguardando_reuniao";
  const hasCommercialFolder = Boolean(technical?.commercial_folder_received);
  const completedMeetings = snapshot.meetings.filter((meeting) => meeting.status === "concluida");
  const hasCompletedMeeting = completedMeetings.length > 0;
  const activeActions = actions.filter((action) => !["concluida", "cancelada"].includes(action.status));
  const openStructuralActions = activeActions.filter(
    (action) => action.action_type === "alteracao_estrutural" && Boolean(action.piece_id),
  );
  const structuralActionsByPieceId = new Map<string, TechnicalAction[]>();
  for (const action of openStructuralActions) {
    if (!action.piece_id) continue;
    const current = structuralActionsByPieceId.get(action.piece_id) ?? [];
    current.push(action);
    structuralActionsByPieceId.set(action.piece_id, current);
  }
  const performedVisits = visits.filter((visit) =>
    ["realizada", "aguardando_relatorio", "relatorio_emitido"].includes(visit.status),
  );
  const activeCorrections = corrections.filter((correction) => !["encerrada", "cancelada"].includes(correction.status));
  const openDoubts = doubts.filter((doubt) => doubt.status === "aberta");
  const approvedOrDeliveredProds = prodBatches.filter((prod) =>
    ["aprovado", "entregue_suprimentos", "entregue_producao", "concluido"].includes(prod.status),
  );
  const releases = snapshot.releases.filter((release) => release.contract_id === id);
  const releaseIds = new Set(releases.map((release) => release.id));
  const releasePieces = snapshot.releasePieces.filter((link) => releaseIds.has(link.release_id));
  const releaseParticipants = snapshot.releaseParticipants.filter((participant) =>
    releaseIds.has(participant.release_id),
  );
  const releaseParticipantsByReleaseId = new Map<string, TechnicalReleaseParticipant[]>();
  for (const participant of releaseParticipants) {
    const current = releaseParticipantsByReleaseId.get(participant.release_id) ?? [];
    current.push(participant);
    releaseParticipantsByReleaseId.set(participant.release_id, current);
  }
  const releasePiecesByReleaseId = new Map<string, TechnicalReleasePiece[]>();
  for (const link of releasePieces) {
    const current = releasePiecesByReleaseId.get(link.release_id) ?? [];
    current.push(link);
    releasePiecesByReleaseId.set(link.release_id, current);
  }
  const latestReleasePieceByPieceId = new Map<string, TechnicalReleasePiece>();
  for (const link of [...releasePieces].sort((left, right) => right.created_at.localeCompare(left.created_at))) {
    if (!latestReleasePieceByPieceId.has(link.piece_id)) {
      latestReleasePieceByPieceId.set(link.piece_id, link);
    }
  }
  const signedReleaseIds = new Set(
    releases
      .filter((release) => isReleaseBatchSigned(release, releaseParticipantsByReleaseId.get(release.id) ?? []))
      .map((release) => release.id),
  );
  const signedReleasePieceIds = new Set(
    [...latestReleasePieceByPieceId.values()]
      .filter((link) => signedReleaseIds.has(link.release_id))
      .map((link) => link.piece_id),
  );
  const releaseCandidates = pieces.filter(
    (piece) => !["liberada", "em_prod", "entregue", "cancelada"].includes(piece.status),
  );
  const piecesReadyForProd = pieces.filter(
    (piece) =>
      piece.status === "liberada" &&
      !piece.project_only &&
      piece.cem_registered &&
      piece.cem_checked &&
      !piece.active_prod_batch_id &&
      signedReleasePieceIds.has(piece.id),
  );
  const pendingReleaseSignatureCount = releases.filter(
    (release) => !isReleaseBatchSigned(release, releaseParticipantsByReleaseId.get(release.id) ?? []),
  ).length;
  const pecasStageStatus = releases.length
    ? pendingReleaseSignatureCount
      ? `${pendingReleaseSignatureCount} lote(s) pendente(s)`
      : `${releaseProgress.released}/${releaseProgress.total} liberada(s)`
    : `${pieces.length} peça(s)`;
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
  const reuniaoReadyForNext = hasCompletedMeeting && reuniaoValidation.complete;
  const visitasReadyForNext = visitasValidation.complete;
  const canRegisterCommercialEntry = canReceiveFolder && reuniaoReadyForNext && currentStatus === "aguardando_pasta" && !hasCommercialFolder;
  const canRegisterMeeting =
    canManageMeetings &&
    currentStatus === "aguardando_reuniao" &&
    !hasCompletedMeeting;
  const canRegisterVisit = canManageVisits && entradaReadyForNext && reuniaoReadyForNext && acoesValidation.complete;
  const canOperatePieces = entradaReadyForNext && reuniaoReadyForNext && acoesValidation.complete && visitasReadyForNext;
  const canCreateProdBatch = canManageProds && piecesReadyForProd.length > 0;

  const tabLinks: Array<readonly [string, string]> = [
    ["#visao-geral", "Visão geral"],
    ["#dados-obra", "Dados da obra"],
    ["#reuniao", "Reunião e ata"],
    ["#entrada", "Entrega da pasta"],
    ["#acoes", "Ações"],
    ["#visitas", "Visitas"],
    ["#pecas", "Medições e liberações"],
    ["#prods", "PRODs"],
    ["#duvidas", "Dúvidas"],
    ["#historico", "Histórico"],
  ];
  if (canDeleteContract) tabLinks.push(["#administracao", "Administração"]);

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
                <StatusBadge status={currentStatus} type="contract" />
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
              {nextAction?.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={nextAction.description}>{nextAction.description}</p>
              ) : nextAction ? <p className="mt-1 text-xs text-muted-foreground">Sem descrição informada.</p> : null}
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
        <StatCard label="Ações abertas" value={activeActions.length + activeCorrections.length} icon={AlertTriangle} tone="danger" href="#acoes" />
        <StatCard label="PRODs ativos" value={prodBatches.filter((item) => !["concluido", "cancelado"].includes(item.status)).length} icon={Factory} />
      </section>

      <FlowStep
        id="dados-obra"
        title="Dados da obra"
        description="Dados gerais da obra e cadastro-base das peças contratadas."
        status={`${pieces.length} peça(s)${canCorrectWorkData || canEditResponsibles || canEditPieceRegistration ? " · edição autorizada" : ""}`}
        locked={!canCorrectWorkData && !canEditResponsibles && !canEditPieceRegistration}
      >
        <div className="space-y-4">
          <ContractPiecesSummary pieces={pieces} canEditRegistration={canEditPieceRegistration} />
          <div className="grid gap-4 border-t border-border pt-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="rounded-md border border-border bg-white p-3 text-sm">
            <h3 className="font-semibold text-charcoal">Dados atuais</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Contrato</dt>
                <dd className="mt-1 text-charcoal">{contract.contract_number}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Cliente</dt>
                <dd className="mt-1 text-charcoal">{client?.name ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Obra</dt>
                <dd className="mt-1 text-charcoal">{contract.work_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Endereço</dt>
                <dd className="mt-1 text-charcoal">{contract.full_address}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Cidade/UF</dt>
                <dd className="mt-1 text-charcoal">
                  {contract.city} - {contract.state}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">CEP</dt>
                <dd className="mt-1 text-charcoal">{contract.zip_code ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Contato</dt>
                <dd className="mt-1 text-charcoal">{contract.site_contact ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Telefone</dt>
                <dd className="mt-1 text-charcoal">{contract.site_contact_phone ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Técnico</dt>
                <dd className="mt-1 text-charcoal">{profileName(snapshot.profiles, technical?.technical_manager_profile_id)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Acompanhamento</dt>
                <dd className="mt-1 text-charcoal">{profileName(snapshot.profiles, technical?.followup_profile_id)}</dd>
              </div>
            </dl>
            {contract.notes ? (
              <p className="mt-3 border-t border-border pt-3 text-muted-foreground">
                <span className="font-semibold text-charcoal">Observações:</span> {contract.notes}
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            {technical && canEditResponsibles ? (
              <ContractResponsiblesForm contract={technical} profiles={snapshot.profiles} />
            ) : null}
            {canCorrectWorkData ? (
              <WorkDataCorrectionForm client={client} contract={contract} />
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                A correção dos dados da obra é restrita aos perfis autorizados pelo Administrador.
              </div>
            )}
            {!canEditResponsibles ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                A alteração de Técnico e Acompanhamento é restrita aos perfis autorizados pelo Administrador.
              </div>
            ) : null}
          </div>
        </div>
        </div>
      </FlowStep>

      <div className="space-y-4">
        <FlowStep
          id="reuniao"
          title="Reunião e ata"
          description="A reunião de fechamento é pré-requisito do fluxo."
          status={stageStatusWithValidation(
            hasCompletedMeeting ? "Concluída" : currentStatus === "aguardando_reuniao" ? "Liberada" : "Bloqueada",
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
                <Field label="Descrição breve da ação">
                  <textarea name="create_action_description" maxLength={240} className={textareaClass} />
                </Field>
                <Field label="Responsável pela ação">
                  <select name="create_action_responsible_profile_id" className={inputClass} defaultValue="">
                    <option value="">Selecione</option>
                    {snapshot.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                  </select>
                </Field>
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

        <FlowStep
          id="entrada"
          title="Entrega da pasta"
          description="Pasta comercial obrigatória antes da primeira visita."
          status={stageStatusWithValidation(
            hasCommercialFolder ? "Concluída" : reuniaoReadyForNext && currentStatus === "aguardando_pasta" ? "Liberada" : "Bloqueada",
            entradaValidation,
            hasCommercialFolder,
          )}
          locked={hasCommercialFolder}
        >
          <div className="space-y-4">
            <StageValidationPanel
              contractId={id}
              stage="entrada_comercial"
              title="Entrega da pasta"
              profiles={snapshot.profiles}
              validation={entradaValidation}
              canManage={canReopenStages}
              stageComplete={hasCommercialFolder && reuniaoReadyForNext}
              completeMessage={reuniaoReadyForNext
                ? "Registre a entrega da pasta para liberar a assinatura dos participantes."
                : "Conclua a reunião e as assinaturas dos participantes antes da entrega da pasta."}
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
                Entrega da pasta concluída. A etapa está travada para alteração direta.
              </div>
            ) : null}
            {hasCommercialFolder && canReopenStages ? (
              <ReopenStageForm contractId={id} stage="entrada_comercial" submitLabel="Reabrir entrega da pasta" />
            ) : null}
          </div>
        </FlowStep>
      </div>

      <FlowStep
        id="acoes"
        title="Ações"
        status={activeActions.length + activeCorrections.length
          ? `${activeActions.length + activeCorrections.length} aberta(s)`
          : !acoesValidation.complete || !correcoesValidation.complete ? "Aguardando ciência" : "Concluída"}
        locked={activeActions.length + activeCorrections.length === 0}
      >
        <div className="space-y-6">
          <TechnicalActionsPanel snapshot={snapshot} access={access} contractId={id} />
          {workItemPermissions.canViewActions ? (
            <details className="group border-t border-border pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Validação das ações gerais
                <ChevronDown className="size-4 group-open:rotate-180" />
              </summary>
              <StageValidationPanel
                contractId={id}
                stage="acoes"
                title="Ações gerais"
                profiles={snapshot.profiles}
                validation={acoesValidation}
                canManage={canReopenStages}
                stageComplete={activeActions.length === 0}
                completeMessage="Valide e conclua as ações gerais abertas para liberar a assinatura dos participantes."
                className="mt-4"
              />
            </details>
          ) : null}
          <span id="correcoes" className="block scroll-mt-4" />
          {workItemPermissions.canViewCorrections ? (
            <details className="group border-t border-border pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Validação das correções técnicas
                <ChevronDown className="size-4 group-open:rotate-180" />
              </summary>
              <StageValidationPanel
                contractId={id}
                stage="correcoes"
                title="Correções técnicas"
                profiles={snapshot.profiles}
                validation={correcoesValidation}
                canManage={canReopenStages}
                stageComplete={activeCorrections.length === 0}
                completeMessage="Encerre ou cancele as correções técnicas abertas para liberar a assinatura dos participantes."
                className="mt-4"
              />
            </details>
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
            {reuniaoReadyForNext && !entradaReadyForNext ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Registre a pasta comercial e conclua suas assinaturas antes de agendar visitas.
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
        title="Medições e liberações"
        description="Registro das medidas encontradas em obra e liberação das peças por lotes."
        status={pecasStageStatus}
      >
        <div className="space-y-3">
          <StageValidationPanel
            contractId={id}
            stage="pecas_medicoes_liberacoes"
            title="Medições e liberações"
            profiles={snapshot.profiles}
            validation={pecasValidation}
            canManage={canReopenStages}
            stageComplete={false}
            completeMessage=""
            signatureMode="release_batch_config"
          />
          {!visitasValidation.complete ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              A etapa de visitas aguarda ciência de todos os participantes antes das ações de peça.
            </div>
          ) : null}
          {canRelease && canOperatePieces ? (
            <ReleaseBatchForm
              contractId={id}
              pieces={releaseCandidates}
              blockingActionsByPieceId={structuralActionsByPieceId}
            />
          ) : null}
          <ReleaseBatchList
            releases={releases}
            releasePiecesByReleaseId={releasePiecesByReleaseId}
            pieces={pieces}
            participantsByReleaseId={releaseParticipantsByReleaseId}
            profiles={snapshot.profiles}
            currentProfileId={authContext.profile.id}
          />
          <div className="space-y-3">
            {pieces.map((piece) => {
              const latestReleaseLink = latestReleasePieceByPieceId.get(piece.id);
              const latestRelease = latestReleaseLink
                ? releases.find((release) => release.id === latestReleaseLink.release_id)
                : null;
              const latestReleaseSigned = latestRelease
                ? isReleaseBatchSigned(latestRelease, releaseParticipantsByReleaseId.get(latestRelease.id) ?? [])
                : false;

              return (
              <details key={piece.id} className="group rounded-md border border-border bg-white">
                <summary className="grid cursor-pointer list-none gap-3 px-3 py-3 marker:hidden sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center">
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
                  {latestRelease ? (
                    <span
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-semibold ring-1",
                        latestReleaseSigned
                          ? "bg-green-50 text-green-800 ring-green-200"
                          : "bg-amber-50 text-amber-800 ring-amber-200",
                      )}
                    >
                      {latestReleaseSigned ? "Lote validado" : "Lote aguardando assinatura"}
                    </span>
                  ) : null}
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
                      <dd className="mt-1 font-semibold text-charcoal">{piece.project_only ? "Projeto" : `${piece.measured_width_mm ?? "-"} x ${piece.measured_height_mm ?? "-"}`}</dd>
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

                  <PieceActionForms
                    piece={piece}
                    canMeasure={canMeasure && canOperatePieces}
                    canManageProds={canManageProds && canOperatePieces}
                    profiles={snapshot.profiles}
                    structuralActions={structuralActionsByPieceId.get(piece.id) ?? []}
                  />
                </div>
              </details>
              );
            })}
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
                      {piece.project_only ? "Projeto" : `${piece.measured_width_mm ?? "-"} x ${piece.measured_height_mm ?? "-"}`}
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
                  canManageProds={canManageProds && canOperatePieces}
                  profiles={snapshot.profiles}
                  structuralActions={structuralActionsByPieceId.get(piece.id) ?? []}
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
                    <td className="border-b border-border px-3 py-3">{piece.project_only ? "Projeto" : `${piece.measured_width_mm ?? "-"} x ${piece.measured_height_mm ?? "-"}`}</td>
                    <td className="border-b border-border px-3 py-3"><StatusBadge status={piece.status} type="piece" /></td>
                    <td className="border-b border-border px-3 py-3">{piece.cem_registered ? "Cad." : "Pendente"} / {piece.cem_checked ? "Conf." : "Pendente"}</td>
                    <td className="border-b border-border px-3 py-3">{formatDate(piece.exceptional_due_date ?? piece.release_due_date)}</td>
                    <td className="border-b border-border px-3 py-3">
                      <PieceActionForms
                        piece={piece}
                        canMeasure={canMeasure && canOperatePieces}
                        canManageProds={canManageProds && canOperatePieces}
                        profiles={snapshot.profiles}
                        structuralActions={structuralActionsByPieceId.get(piece.id) ?? []}
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
          {canManageProds && !canCreateProdBatch ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {pendingReleaseSignatureCount
                ? "Há lote(s) de liberação aguardando assinatura antes de montar PROD."
                : "Nenhuma peça está pronta para PROD. A peça precisa estar em lote validado e com cadastro/conferência no CEM."}
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
                  {piecesReadyForProd.map((piece) => (
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
          {snapshot.auditLogs.map((log) => {
            const auditEntry = formatAuditLogEntry(log, snapshot.profiles);

            return (
              <article key={log.id} className="rounded-md border border-border bg-white p-3 text-sm">
                <div className="flex items-start gap-2 font-semibold text-charcoal">
                  <History className="mt-0.5 size-4 flex-none text-accent" />
                  <span>{auditEntry.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.created_at)}</p>
                {auditEntry.details ? <p className="mt-2 text-muted-foreground">{auditEntry.details}</p> : null}
              </article>
            );
          })}
          {!snapshot.auditLogs.length ? <p className="text-sm text-muted-foreground">Sem histórico carregado.</p> : null}
        </div>
      </FlowStep>

      {canDeleteContract ? (
        <FlowStep
          id="administracao"
          title="Administração"
          description="Ações exclusivas do Administrador para correções excepcionais."
          status="Administrador"
        >
          <DeleteTechnicalContractForm contractId={id} contractNumber={contract.contract_number} />
        </FlowStep>
      ) : null}
    </div>
  );
}
