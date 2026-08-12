import type { Profile, TechnicalAuditLog, TechnicalContractStageKey } from "@/lib/types";

type AuditProfile = Pick<Profile, "id" | "user_id" | "name">;

type AuditSummary = {
  title: string;
  details: string | null;
};

const entityLabels: Record<string, string> = {
  production_contracts: "dados da obra",
  profiles: "cadastro de usuário",
  technical_contract_import: "importação de contrato",
  technical_contract_pieces: "cadastro de peça",
  technical_contracts: "contrato técnico",
  technical_release_participants: "assinatura de lote de liberação",
  technical_releases: "lote de liberação",
  technical_stage_validation_participants: "assinatura de etapa",
  technical_stage_validations: "validação de etapa",
};

const stageLabels: Record<TechnicalContractStageKey, string> = {
  entrada_comercial: "Entrada comercial",
  reuniao_ata: "Reunião e ata",
  acoes: "Ações",
  visitas: "Visitas",
  pecas_medicoes_liberacoes: "Peças, medições e liberações",
  correcoes: "Correções",
  prods: "PRODs",
  duvidas: "Dúvidas",
};

function valueAsString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function valueAsNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function valueAsStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stageName(value: unknown) {
  const key = valueAsString(value) as TechnicalContractStageKey | null;
  return key && stageLabels[key] ? stageLabels[key] : "etapa";
}

function profileDisplayName(profiles: AuditProfile[], userId?: string | null) {
  if (!userId) return null;
  return profiles.find((profile) => profile.user_id === userId || profile.id === userId)?.name ?? null;
}

function actedBy(actorName: string | null, action: string) {
  return actorName ? `O usuário ${actorName} ${action}.` : `O sistema ${action}.`;
}

function defaultDetails(log: TechnicalAuditLog) {
  return valueAsString(log.notes);
}

function pdfImportDetails(log: TechnicalAuditLog) {
  const contractNumber = valueAsString(log.after_data?.contractNumber);
  const importedPieces = valueAsNumber(log.after_data?.pieces);
  const insertedPieces = valueAsNumber(log.after_data?.insertedPieces);
  const skippedCodes = valueAsStringArray(log.after_data?.skippedDuplicatePieceCodes);
  const details = [
    contractNumber ? `Contrato ${contractNumber}` : null,
    importedPieces !== null ? `${importedPieces} peça(s) importada(s)` : null,
    insertedPieces !== null ? `${insertedPieces} peça(s) nova(s) importada(s)` : null,
    skippedCodes.length ? `${skippedCodes.length} peça(s) já cadastrada(s) ignorada(s)` : null,
  ].filter(Boolean);

  return details.length ? `${details.join(" · ")}.` : defaultDetails(log);
}

function pieceRegistrationDetails(log: TechnicalAuditLog) {
  const beforeCode = valueAsString(log.before_data?.code);
  const afterCode = valueAsString(log.after_data?.code);
  const changes = [
    beforeCode && afterCode && beforeCode !== afterCode ? `Código: ${beforeCode} -> ${afterCode}` : null,
    valueAsString(log.notes),
  ].filter(Boolean);

  return changes.length ? changes.join(" · ") : null;
}

function workDataDetails(log: TechnicalAuditLog) {
  const beforeWorkName = valueAsString(log.before_data?.work_name);
  const afterWorkName = valueAsString(log.after_data?.work_name);
  const beforeAddress = valueAsString(log.before_data?.full_address);
  const afterAddress = valueAsString(log.after_data?.full_address);
  const changes = [
    beforeWorkName && afterWorkName && beforeWorkName !== afterWorkName
      ? `Obra: ${beforeWorkName} -> ${afterWorkName}`
      : null,
    beforeAddress && afterAddress && beforeAddress !== afterAddress
      ? `Endereço: ${beforeAddress} -> ${afterAddress}`
      : null,
    valueAsString(log.notes),
  ].filter(Boolean);

  return changes.length ? changes.join(" · ") : null;
}

function releaseBatchDetails(log: TechnicalAuditLog) {
  const batchNumber = valueAsString(log.after_data?.batch_number);
  const pieceIds = Array.isArray(log.after_data?.piece_ids) ? log.after_data.piece_ids.length : null;
  const environmentUpdates = Array.isArray(log.after_data?.environment_updates)
    ? log.after_data.environment_updates
        .map((item) => {
          const update = item as { code?: unknown; before?: unknown; after?: unknown };
          const code = valueAsString(update.code);
          const before = valueAsString(update.before) ?? "sem ambiente";
          const after = valueAsString(update.after) ?? "sem ambiente";
          return code ? `${code}: ${before} -> ${after}` : null;
        })
        .filter(Boolean)
    : [];
  const details = [
    batchNumber ? `Lote: ${batchNumber}` : null,
    pieceIds !== null ? `${pieceIds} peça(s)` : null,
    environmentUpdates.length ? `Ambiente ajustado: ${environmentUpdates.join("; ")}` : null,
    valueAsString(log.notes),
  ].filter(Boolean);

  return details.length ? details.join(" · ") : null;
}

export function formatAuditLogEntry(log: TechnicalAuditLog, profiles: AuditProfile[]): AuditSummary {
  const actorName = profileDisplayName(profiles, log.user_id);
  const actionKey = `${log.entity}:${log.action}`;

  switch (actionKey) {
    case "technical_contract_import:confirm_pdf_import":
      return {
        title: actedBy(actorName, "confirmou a importação de PDF do contrato"),
        details: pdfImportDetails(log),
      };
    case "technical_contract_import:reprocess_pdf_import":
      return {
        title: actedBy(actorName, "realizou um reprocessamento de importação de PDF"),
        details: pdfImportDetails(log),
      };
    case "technical_contract_import:manual_create":
      return {
        title: actedBy(actorName, "cadastrou o contrato manualmente"),
        details: defaultDetails(log),
      };
    case "technical_contracts:insert":
      return {
        title: actedBy(actorName, "criou o registro técnico do contrato"),
        details: defaultDetails(log),
      };
    case "technical_contracts:update":
      return {
        title: actedBy(actorName, "atualizou os dados técnicos do contrato"),
        details: defaultDetails(log),
      };
    case "technical_contracts:reopen_stage":
      return {
        title: actedBy(actorName, `reabriu a etapa ${stageName(log.after_data?.stage)}`),
        details: defaultDetails(log),
      };
    case "technical_stage_validations:configure_stage_validation":
      return {
        title: actedBy(actorName, `atualizou a validação da etapa ${stageName(log.after_data?.stage)}`),
        details: defaultDetails(log),
      };
    case "technical_stage_validation_participants:stage_signature":
      return {
        title: actedBy(actorName, `assinou digitalmente a etapa ${stageName(log.after_data?.stage)}`),
        details: defaultDetails(log),
      };
    case "technical_contract_pieces:registration_update":
      return {
        title: actedBy(actorName, `atualizou o cadastro da peça ${valueAsString(log.after_data?.code) ?? ""}`.trim()),
        details: pieceRegistrationDetails(log),
      };
    case "technical_releases:release_batch_create":
      return {
        title: actedBy(actorName, "criou um lote de liberação de medidas"),
        details: releaseBatchDetails(log),
      };
    case "technical_release_participants:release_batch_signature":
      return {
        title: actedBy(actorName, "assinou digitalmente um lote de liberação"),
        details: defaultDetails(log),
      };
    case "production_contracts:work_data_update":
      return {
        title: actedBy(actorName, "corrigiu os dados da obra do contrato"),
        details: workDataDetails(log),
      };
    case "profiles:profile_update":
      return {
        title: actedBy(actorName, `atualizou o cadastro do usuário ${valueAsString(log.after_data?.name) ?? ""}`.trim()),
        details: defaultDetails(log),
      };
    case "profiles:password_reset":
      return {
        title: actedBy(actorName, `redefiniu a senha de ${valueAsString(log.after_data?.email) ?? "um usuário"}`),
        details: defaultDetails(log),
      };
    default:
      return {
        title: actedBy(
          actorName,
          `registrou uma alteração em ${entityLabels[log.entity] ?? "um registro do sistema"}`,
        ),
        details: defaultDetails(log),
      };
  }
}
