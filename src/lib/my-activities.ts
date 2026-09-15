import { getWorkItemPermissions, type PermissionLookup } from "@/lib/module-access";
import { isOverdue, isStageValidationSatisfied } from "@/lib/technical-rules";
import type { ProductionContract, TechnicalAction, TechnicalContract, TechnicalContractStageKey, TechnicalCorrection, TechnicalRelease, TechnicalReleaseParticipant, TechnicalStageValidation, TechnicalStageValidationParticipant } from "@/lib/types";

export type MyActivity = {
  id: string;
  kind: "action" | "correction" | "stage_signature" | "release_signature";
  title: string;
  contractId: string;
  contractNumber: string;
  workName: string;
  dueDate: string | null;
  available: boolean;
  nextStep: string;
  href: string;
  linkLabel: string;
  blocking: boolean;
};

export const activityKindLabels: Record<MyActivity["kind"], string> = {
  action: "Ação geral", correction: "Correção técnica",
  stage_signature: "Assinatura de etapa", release_signature: "Assinatura de lote",
};

export const activityStageLabels: Record<TechnicalContractStageKey, string> = {
  entrada_comercial: "Entrega da pasta", reuniao_ata: "Reunião e ata", acoes: "Ações gerais",
  visitas: "Visitas", pecas_medicoes_liberacoes: "Medições e liberações",
  correcoes: "Correções técnicas", prods: "PRODs", duvidas: "Base de dúvidas",
};

export type MyActivitiesSource = {
  contracts: Pick<ProductionContract, "id" | "company_id" | "active" | "contract_number" | "work_name">[];
  technicalContracts: Pick<TechnicalContract, "company_id" | "contract_id" | "deleted_at" | "commercial_folder_received">[];
  actions: Pick<TechnicalAction, "id" | "company_id" | "contract_id" | "title" | "responsible_profile_id" | "due_date" | "status" | "blocking" | "deleted_at">[];
  corrections: Pick<TechnicalCorrection, "id" | "company_id" | "contract_id" | "type" | "responsible_profile_id" | "due_date" | "status" | "blocking" | "deleted_at">[];
  validations: Pick<TechnicalStageValidation, "company_id" | "contract_id" | "stage" | "validation_required">[];
  stageParticipants: Pick<TechnicalStageValidationParticipant, "id" | "company_id" | "contract_id" | "stage" | "profile_id" | "signed_at">[];
  releases: Pick<TechnicalRelease, "id" | "company_id" | "contract_id" | "batch_number" | "status" | "validation_required">[];
  releaseParticipants: Pick<TechnicalReleaseParticipant, "id" | "company_id" | "release_id" | "profile_id" | "signed_at">[];
  completedMeetings: string[];
  meetingSignatures: Pick<TechnicalStageValidationParticipant, "company_id" | "contract_id" | "signed_at">[];
  performedVisits: string[];
  openActions: string[];
  openCorrections: string[];
  approvedProds: string[];
  openDoubts: string[];
};

export function buildMyActivities(source: MyActivitiesSource, identity: { companyId: string; profileId: string }, access: PermissionLookup): MyActivity[] {
  const { companyId, profileId } = identity;
  const rights = getWorkItemPermissions(access);
  const canViewContracts = access.isMaster || Boolean(access.permissions["technical.contracts.view"]);
  const technical = source.technicalContracts.filter((row) => row.company_id === companyId);
  const deletedContracts = new Set(technical.filter((row) => row.deleted_at).map((row) => row.contract_id));
  const contracts = new Map(source.contracts.filter((row) => row.company_id === companyId && row.active !== false && !deletedContracts.has(row.id)).map((row) => [row.id, row]));
  const items: MyActivity[] = [];
  function add(contractId: string, item: Omit<MyActivity, "contractId" | "contractNumber" | "workName">) {
    const contract = contracts.get(contractId);
    if (contract) items.push({ ...item, contractId, contractNumber: contract.contract_number, workName: contract.work_name });
  }
  function actionHref(contractId: string, kind: "action" | "correction", id: string) {
    const base = canViewContracts ? `/tecnico/contratos/${contractId}` : "/tecnico/acoes";
    return `${base}#atividade-${kind}-${id}`;
  }

  if (rights.canViewActions) for (const action of source.actions) {
    if (action.company_id !== companyId || action.responsible_profile_id !== profileId || action.deleted_at || ["concluida", "cancelada"].includes(action.status)) continue;
    add(action.contract_id, {
      id: `action-${action.id}`, kind: "action", title: action.title, dueDate: action.due_date,
      available: rights.canManageActions, blocking: action.blocking,
      nextStep: !rights.canManageActions ? "Aguardando permissão para gerenciar ações."
        : action.status === "validada" ? "Validada. Concluir a ação."
          : "Executar ou acompanhar a ação. A conclusão exige validação do gestor.",
      href: actionHref(action.contract_id, "action", action.id), linkLabel: "Abrir ação",
    });
  }
  if (rights.canViewCorrections) for (const correction of source.corrections) {
    if (correction.company_id !== companyId || correction.responsible_profile_id !== profileId || correction.deleted_at || ["encerrada", "cancelada"].includes(correction.status)) continue;
    add(correction.contract_id, {
      id: `correction-${correction.id}`, kind: "correction", title: correction.type, dueDate: correction.due_date,
      available: rights.canManageCorrections, blocking: correction.blocking,
      nextStep: rights.canManageCorrections ? "Resolver e encerrar a correção." : "Aguardando permissão para gerenciar correções.",
      href: actionHref(correction.contract_id, "correction", correction.id), linkLabel: "Abrir correção",
    });
  }

  if (canViewContracts) {
    const received = new Set(technical.filter((row) => row.commercial_folder_received).map((row) => row.contract_id));
    const completedMeetings = new Set(source.completedMeetings);
    const performedVisits = new Set(source.performedVisits);
    const openActions = new Set(source.openActions);
    const openCorrections = new Set(source.openCorrections);
    const approvedProds = new Set(source.approvedProds);
    const openDoubts = new Set(source.openDoubts);
    const required = new Set(source.validations.filter((row) => row.company_id === companyId && row.validation_required).map((row) => `${row.contract_id}:${row.stage}`));
    for (const participant of source.stageParticipants) {
      const { contract_id: contractId, stage } = participant;
      if (participant.company_id !== companyId || participant.profile_id !== profileId || participant.signed_at || !required.has(`${contractId}:${stage}`)) continue;
      // Piece-stage participants configure future batches; only actual batches require a signature.
      if (stage === "pecas_medicoes_liberacoes" || (stage === "acoes" && !rights.canViewActions) || (stage === "correcoes" && !rights.canViewCorrections)) continue;
      const waiting: Partial<Record<TechnicalContractStageKey, string | null>> = {
        entrada_comercial: !completedMeetings.has(contractId)
          ? "Aguardando a conclusão da reunião e ata."
          : !isStageValidationSatisfied({
              validation: { validation_required: required.has(`${contractId}:reuniao_ata`) },
              participants: source.meetingSignatures.filter((row) => row.company_id === companyId && row.contract_id === contractId),
            }) ? "Aguardando as assinaturas da reunião e ata."
            : received.has(contractId) ? null : "Aguardando o registro da entrega da pasta.",
        reuniao_ata: completedMeetings.has(contractId) ? null : "Aguardando a conclusão da reunião e ata.",
        acoes: openActions.has(contractId) ? "Aguardando a conclusão das ações gerais do contrato." : null,
        visitas: performedVisits.has(contractId) ? null : "Aguardando o registro de uma visita realizada.",
        correcoes: openCorrections.has(contractId) ? "Aguardando o encerramento das correções técnicas." : null,
        prods: approvedProds.has(contractId) ? null : "Aguardando a aprovação de pelo menos um PROD.",
        duvidas: openDoubts.has(contractId) ? "Aguardando a resposta ou o encerramento das dúvidas." : null,
      };
      add(contractId, {
        id: `stage-${participant.id}`, kind: "stage_signature", title: activityStageLabels[stage], dueDate: null,
        available: !waiting[stage], nextStep: waiting[stage] ?? "Conferir a etapa e registrar sua ciência.", blocking: false,
        href: `/tecnico/contratos/${contractId}#assinatura-${stage}`, linkLabel: waiting[stage] ? "Ver etapa" : "Conferir e assinar",
      });
    }
    const releases = new Map(source.releases.filter((row) => row.company_id === companyId && row.validation_required && row.status !== "cancelado").map((row) => [row.id, row]));
    for (const participant of source.releaseParticipants) {
      if (participant.company_id !== companyId || participant.profile_id !== profileId || participant.signed_at) continue;
      const release = releases.get(participant.release_id);
      if (!release) continue;
      add(release.contract_id, {
        id: `release-${participant.id}`, kind: "release_signature", title: release.batch_number ?? "Lote de liberação", dueDate: null,
        available: true, nextStep: "Conferir as peças deste lote e registrar sua assinatura.", blocking: false,
        href: `/tecnico/contratos/${release.contract_id}#lote-${release.id}`, linkLabel: "Conferir e assinar lote",
      });
    }
  }
  return items.sort((a, b) => Number(b.available) - Number(a.available) || Number(isOverdue(b.dueDate)) - Number(isOverdue(a.dueDate)) || Number(b.blocking) - Number(a.blocking) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.contractNumber.localeCompare(b.contractNumber) || a.id.localeCompare(b.id));
}
