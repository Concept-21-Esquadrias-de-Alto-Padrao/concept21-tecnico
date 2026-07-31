"use server";

import { revalidatePath } from "next/cache";
import {
  actionSchema,
  actionTransitionSchema,
  answerDoubtSchema,
  cancelVisitSchema,
  confirmedImportSchema,
  correctionSchema,
  deletionRequestSchema,
  deliverySchema,
  doubtSchema,
  formDataToObject,
  manualContractSchema,
  meetingSchema,
  pieceCemSchema,
  pieceMeasurementSchema,
  prodBatchSchema,
  prodBatchTransitionSchema,
  receiveFolderSchema,
  releasePieceSchema,
  splitPieceSchema,
  visitResultSchema,
  visitSchema,
} from "@/lib/schemas";
import {
  HttpError,
  hasActiveMasterRole,
  requireMasterAccess,
  requirePermissionAccess,
} from "@/lib/server-access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addDeadlineDays,
  canAddPieceToProd,
  canApproveProd,
  canConfirmDepartmentDelivery,
  canReleasePiece,
} from "@/lib/technical-rules";
import type { ActionState } from "@/components/action-form";
import type { ParsedTechnicalContract, ParsedTechnicalPiece } from "@/lib/technical-pdf";
import type { TechnicalCorrection, TechnicalPiece, TechnicalProdBatch } from "@/lib/types";
import { toUserFriendlyErrorMessage } from "@/lib/errors";

type ActionContext = {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  authUserId: string;
  profileId: string;
  companyId: string;
  isMaster: boolean;
};

function ok(message: string): ActionState {
  return { ok: true, message };
}

function fail(error: unknown, fallback = "Não foi possível concluir a operação."): ActionState {
  return { ok: false, message: toUserFriendlyErrorMessage(error, fallback) };
}

async function getActionContext(permissionKey: string, message?: string): Promise<ActionContext> {
  const context = await requirePermissionAccess(permissionKey, message);
  const isMaster = await hasActiveMasterRole(context.admin, context.profile);

  return {
    admin: context.admin,
    authUserId: context.authUserId,
    profileId: context.profile.id,
    companyId: context.profile.company_id,
    isMaster,
  };
}

async function getMasterActionContext(): Promise<ActionContext> {
  const context = await requireMasterAccess();

  return {
    admin: context.admin,
    authUserId: context.authUserId,
    profileId: context.profile.id,
    companyId: context.profile.company_id,
    isMaster: true,
  };
}

async function hasContextPermission(context: ActionContext, permissionKey: string) {
  if (context.isMaster) return true;

  const { data: permission, error: permissionError } = await context.admin
    .from("permissions")
    .select("id")
    .eq("key", permissionKey)
    .maybeSingle();

  if (permissionError) throw permissionError;
  if (!permission) return false;

  const { data: userRoles, error: rolesError } = await context.admin
    .from("user_roles")
    .select("role_id")
    .eq("company_id", context.companyId)
    .eq("profile_id", context.profileId);

  if (rolesError) throw rolesError;
  const roleIds = ((userRoles ?? []) as Array<{ role_id: string | null }>)
    .map((role) => role.role_id)
    .filter((roleId): roleId is string => Boolean(roleId));

  if (!roleIds.length) return false;

  const { data: activeRoles, error: activeRoleError } = await context.admin
    .from("roles")
    .select("id")
    .eq("company_id", context.companyId)
    .eq("active", true)
    .in("id", roleIds);

  if (activeRoleError) throw activeRoleError;
  const activeRoleIds = ((activeRoles ?? []) as Array<{ id: string }>).map((role) => role.id);
  if (!activeRoleIds.length) return false;

  const { data: grants, error: grantError } = await context.admin
    .from("role_permissions")
    .select("id")
    .eq("company_id", context.companyId)
    .eq("permission_id", (permission as { id: string }).id)
    .in("role_id", activeRoleIds)
    .limit(1);

  if (grantError) throw grantError;
  return Boolean((grants ?? []).length);
}

function revalidateTechnical(contractId?: string) {
  revalidatePath("/tecnico");
  revalidatePath("/tecnico/contratos");
  revalidatePath("/tecnico/agenda");
  revalidatePath("/tecnico/acoes");
  revalidatePath("/tecnico/correcoes");
  revalidatePath("/tecnico/prods");
  revalidatePath("/tecnico/duvidas");
  revalidatePath("/tecnico/relatorios");
  revalidatePath("/tecnico/configuracoes");
  if (contractId) revalidatePath(`/tecnico/contratos/${contractId}`);
}

function splitTextList(value: string) {
  return value
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function idsFromForm(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map(String)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonPayload<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label} inválido para confirmação.`);
  }
}

function actionFormData(first: ActionState | FormData, second?: FormData) {
  return second ?? (first instanceof FormData ? first : new FormData());
}

async function findOrCreateClient(context: ActionContext, clientName: string) {
  const name = clientName.trim();

  const { data: existing, error: existingError } = await context.admin
    .from("clients")
    .select("id")
    .eq("company_id", context.companyId)
    .ilike("name", name)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return String((existing as { id: string }).id);

  const { data, error } = await context.admin
    .from("clients")
    .insert({
      company_id: context.companyId,
      name,
      trade_name: null,
      active: true,
      created_by: context.authUserId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return String((data as { id: string }).id);
}

async function assertContractNotDuplicated(context: ActionContext, contractNumber: string) {
  const { data, error } = await context.admin
    .from("production_contracts")
    .select("id")
    .eq("company_id", context.companyId)
    .eq("contract_number", contractNumber)
    .eq("active", true)
    .limit(1);

  if (error) throw error;
  if ((data ?? []).length) {
    throw new Error("Já existe contrato ativo com este número. Revise a duplicidade antes de gravar.");
  }
}

async function createTechnicalContract({
  context,
  contractNumber,
  clientName,
  workName,
  fullAddress,
  city = "Goiânia",
  state = "GO",
  contractDate,
  deadlineValue,
  deadlineUnit,
  description,
  technicalManagerProfileId,
  followupProfileId,
  authorizedContacts = [],
  commercialData = {},
  pieces = [],
  source,
}: {
  context: ActionContext;
  contractNumber: string;
  clientName: string;
  workName: string;
  fullAddress: string;
  city?: string;
  state?: string;
  contractDate: string | null;
  deadlineValue: number | null;
  deadlineUnit: "dias_uteis" | "dias_corridos";
  description: string | null;
  technicalManagerProfileId?: string | null;
  followupProfileId?: string | null;
  authorizedContacts?: Array<Record<string, unknown>>;
  commercialData?: Record<string, unknown>;
  pieces?: ParsedTechnicalPiece[];
  source: "manual" | "pdf";
}) {
  await assertContractNotDuplicated(context, contractNumber);
  const clientId = await findOrCreateClient(context, clientName);

  const { data: contract, error: contractError } = await context.admin
    .from("production_contracts")
    .insert({
      company_id: context.companyId,
      contract_number: contractNumber,
      client_id: clientId,
      work_name: workName,
      full_address: fullAddress,
      city,
      state,
      notes: description,
      status: "ativo",
      active: true,
      created_by: context.authUserId,
    })
    .select("id")
    .single();

  if (contractError) throw contractError;
  const contractId = String((contract as { id: string }).id);

  const { error: technicalError } = await context.admin.from("technical_contracts").insert({
    company_id: context.companyId,
    contract_id: contractId,
    contract_date: contractDate,
    contractual_deadline_value: deadlineValue,
    contractual_deadline_unit: deadlineUnit,
    technical_status: "aguardando_pasta",
    technical_manager_profile_id: technicalManagerProfileId || null,
    followup_profile_id: followupProfileId || null,
    commercial_folder_received: false,
    commercial_data: {
      ...commercialData,
      origem_cadastro: source,
    },
    authorized_contacts: authorizedContacts,
    technical_notes: description,
  });

  if (technicalError) throw technicalError;

  if (pieces.length) {
    const { error: piecesError } = await context.admin.from("technical_contract_pieces").insert(
      pieces.map((piece, index) => ({
        company_id: context.companyId,
        contract_id: contractId,
        code: piece.code,
        piece_type: piece.piece_type,
        quantity: piece.quantity,
        sale_width_mm: piece.sale_width_mm,
        sale_height_mm: piece.sale_height_mm,
        environment: piece.environment,
        description: piece.description,
        glass: piece.glass,
        color: piece.color,
        line: piece.line,
        status: "aguardando_avaliacao",
        source,
        sort_order: index + 1,
      })),
    );

    if (piecesError) throw piecesError;
  }

  const { error: auditError } = await context.admin.from("audit_logs").insert({
    company_id: context.companyId,
    entity: "technical_contract_import",
    entity_id: contractId,
    action: source === "pdf" ? "confirm_pdf_import" : "manual_create",
    user_id: context.authUserId,
    after_data: { contractNumber, pieces: pieces.length },
    notes: source === "pdf" ? "Contrato gravado após conferência humana." : "Contrato cadastrado manualmente.",
  });

  if (auditError) throw auditError;

  return contractId;
}

export async function createManualContractAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext(
      "technical.contracts.manual_create",
      "Você não possui permissão para cadastrar contratos manualmente.",
    );
    const parsed = manualContractSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const contractId = await createTechnicalContract({
      context,
      contractNumber: parsed.data.contract_number,
      clientName: parsed.data.client_name,
      workName: parsed.data.work_name,
      fullAddress: parsed.data.full_address,
      city: parsed.data.city,
      state: parsed.data.state,
      contractDate: parsed.data.contract_date,
      deadlineValue: parsed.data.contractual_deadline_value,
      deadlineUnit: parsed.data.contractual_deadline_unit,
      description: parsed.data.description ?? null,
      technicalManagerProfileId: parsed.data.technical_manager_profile_id ?? null,
      followupProfileId: parsed.data.followup_profile_id ?? null,
      source: "manual",
    });

    revalidateTechnical(contractId);
    return ok("Contrato técnico cadastrado.");
  } catch (error) {
    return fail(error);
  }
}

export async function confirmContractImportAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext(
      "technical.contracts.import_pdf",
      "Você não possui permissão para importar contratos por PDF.",
    );
    const parsed = confirmedImportSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const contract = parseJsonPayload<ParsedTechnicalContract>(parsed.data.contract_json, "Contrato");
    const pieces = parseJsonPayload<ParsedTechnicalPiece[]>(parsed.data.pieces_json, "Peças");

    if (!contract.contract_number) throw new Error("Informe o número do contrato antes de gravar.");
    if (!contract.client_name) throw new Error("Informe o cliente antes de gravar.");

    const contractId = await createTechnicalContract({
      context,
      contractNumber: contract.contract_number,
      clientName: contract.client_name,
      workName: contract.work_name ?? contract.contract_number,
      fullAddress: contract.work_address ?? "Endereço a conferir",
      contractDate: contract.contract_date,
      deadlineValue: contract.deadline_value,
      deadlineUnit: contract.deadline_unit,
      description: contract.description,
      authorizedContacts: contract.authorized_contacts,
      commercialData: contract.commercial_data,
      pieces,
      source: "pdf",
    });

    revalidateTechnical(contractId);
    return ok("Importação confirmada e gravada.");
  } catch (error) {
    return fail(error);
  }
}

export async function receiveCommercialFolderAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.folder.receive");
    const parsed = receiveFolderSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await context.admin
      .from("technical_contracts")
      .update({
        commercial_folder_received: true,
        folder_received_at: parsed.data.folder_received_at,
        folder_delivered_by: parsed.data.folder_delivered_by,
        folder_received_by_profile_id: context.profileId,
        technical_notes: parsed.data.technical_notes,
        technical_status: "aguardando_reuniao",
      })
      .eq("company_id", context.companyId)
      .eq("contract_id", parsed.data.contract_id);

    if (error) throw error;
    revalidateTechnical(parsed.data.contract_id);
    return ok("Pasta comercial registrada.");
  } catch (error) {
    return fail(error);
  }
}

export async function createMeetingAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.meetings.manage");
    const parsed = meetingSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: meeting, error } = await context.admin
      .from("technical_closing_meetings")
      .insert({
        company_id: context.companyId,
        contract_id: parsed.data.contract_id,
        meeting_date: parsed.data.meeting_date,
        meeting_time: parsed.data.meeting_time,
        participants: splitTextList(parsed.data.participants),
        summary: parsed.data.summary,
        decisions: parsed.data.decisions,
        blockers: parsed.data.blockers,
        status: "concluida",
        registered_by_profile_id: context.profileId,
      })
      .select("id")
      .single();

    if (error) throw error;

    if (parsed.data.create_action_title) {
      const { error: actionError } = await context.admin.from("technical_actions").insert({
        company_id: context.companyId,
        contract_id: parsed.data.contract_id,
        meeting_id: (meeting as { id: string }).id,
        title: parsed.data.create_action_title,
        due_date: parsed.data.create_action_due_date,
        priority: "normal",
        blocking: true,
        blocking_stage: "entrada_inicial",
        status: "aberta",
      });
      if (actionError) throw actionError;
    }

    const { error: statusError } = await context.admin
      .from("technical_contracts")
      .update({ technical_status: "em_acompanhamento" })
      .eq("company_id", context.companyId)
      .eq("contract_id", parsed.data.contract_id);

    if (statusError) throw statusError;
    revalidateTechnical(parsed.data.contract_id);
    return ok("Reunião e ata registradas.");
  } catch (error) {
    return fail(error);
  }
}

export async function createTechnicalActionAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.actions.manage");
    const parsed = actionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await context.admin.from("technical_actions").insert({
      company_id: context.companyId,
      ...parsed.data,
      status: "aberta",
    });

    if (error) throw error;
    revalidateTechnical(parsed.data.contract_id);
    return ok("Ação registrada.");
  } catch (error) {
    return fail(error);
  }
}

export async function transitionTechnicalActionAction(first: ActionState | FormData, second?: FormData) {
  try {
    const formData = actionFormData(first, second);
    const context = await getActionContext("technical.actions.manage");
    const parsed = actionTransitionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    if (parsed.data.next_status === "aberta") {
      const canReopen = await hasContextPermission(context, "technical.actions.reopen");
      if (!canReopen) throw new Error("Você não possui permissão para reabrir ações.");
    }

    const now = new Date().toISOString();
    const { data: current, error: currentError } = await context.admin
      .from("technical_actions")
      .select("contract_id")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) throw new Error("Ação não encontrada.");

    const { error } = await context.admin
      .from("technical_actions")
      .update({
        status: parsed.data.next_status,
        completed_at: parsed.data.next_status === "concluida" ? now : null,
        validated_at: parsed.data.next_status === "validada" ? now : null,
      })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);

    if (error) throw error;
    revalidateTechnical(String((current as { contract_id: string }).contract_id));
    return ok("Ação atualizada.");
  } catch (error) {
    return fail(error);
  }
}

export async function createVisitAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.visits.manage");
    const parsed = visitSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: gate, error: gateError } = await context.admin.rpc("technical_validate_visit_ready", {
      target_contract_id: parsed.data.contract_id,
    });

    if (gateError) throw gateError;
    if (gate !== true) throw new Error(String(gate || "Contrato ainda não cumpre os pré-requisitos da visita."));

    const { data: visit, error } = await context.admin
      .from("technical_visits")
      .insert({
        company_id: context.companyId,
        contract_id: parsed.data.contract_id,
        visit_type: parsed.data.visit_type,
        scheduled_date: parsed.data.scheduled_date,
        scheduled_time: parsed.data.scheduled_time,
        technicians: splitTextList(parsed.data.technicians),
        objectives: splitTextList(parsed.data.objectives),
        status: "agendada",
      })
      .select("id")
      .single();

    if (error) throw error;
    const visitId = String((visit as { id: string }).id);
    const pieceIds = idsFromForm(formData, "piece_ids");

    if (pieceIds.length) {
      const { error: linkError } = await context.admin.from("technical_visit_pieces").insert(
        pieceIds.map((pieceId) => ({
          visit_id: visitId,
          piece_id: pieceId,
        })),
      );
      if (linkError) throw linkError;
    }

    await context.admin
      .from("technical_contracts")
      .update({ technical_status: "aguardando_visita" })
      .eq("company_id", context.companyId)
      .eq("contract_id", parsed.data.contract_id);

    revalidateTechnical(parsed.data.contract_id);
    return ok("Visita agendada.");
  } catch (error) {
    return fail(error);
  }
}

export async function recordVisitResultAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.visits.manage");
    const parsed = visitResultSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: visit, error: visitError } = await context.admin
      .from("technical_visits")
      .select("contract_id")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (visitError) throw visitError;
    if (!visit) throw new Error("Visita não encontrada.");

    const { error } = await context.admin
      .from("technical_visits")
      .update({
        performed_at: parsed.data.performed_at,
        accompanied_by: parsed.data.accompanied_by,
        result_summary: parsed.data.result_summary,
        status: "aguardando_relatorio",
      })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);

    if (error) throw error;
    revalidateTechnical(String((visit as { contract_id: string }).contract_id));
    return ok("Resultado da visita registrado.");
  } catch (error) {
    return fail(error);
  }
}

export async function generateVisitReportAction(first: ActionState | FormData, second?: FormData) {
  try {
    const formData = actionFormData(first, second);
    const context = await getActionContext("technical.reports.generate");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Visita inválida.");

    const { data: visit, error: visitError } = await context.admin
      .from("technical_visits")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("id", id)
      .maybeSingle();
    if (visitError) throw visitError;
    if (!visit) throw new Error("Visita não encontrada.");

    const { data: pieces, error: piecesError } = await context.admin
      .from("technical_visit_pieces")
      .select("*, piece:technical_contract_pieces(*)")
      .eq("visit_id", id);
    if (piecesError) throw piecesError;

    const snapshot = {
      visit,
      pieces: pieces ?? [],
      generated_by_profile_id: context.profileId,
      generated_at: new Date().toISOString(),
    };

    const { error } = await context.admin
      .from("technical_visits")
      .update({
        report_generated_at: new Date().toISOString(),
        report_snapshot: snapshot,
        status: "relatorio_emitido",
      })
      .eq("company_id", context.companyId)
      .eq("id", id);
    if (error) throw error;

    await context.admin.from("technical_report_events").insert({
      company_id: context.companyId,
      contract_id: String((visit as { contract_id: string }).contract_id),
      visit_id: id,
      event_type: "relatorio_gerado",
      structured_snapshot: snapshot,
      created_by_profile_id: context.profileId,
    });

    revalidateTechnical(String((visit as { contract_id: string }).contract_id));
    return ok("Relatório gerado e snapshot registrado.");
  } catch (error) {
    return fail(error);
  }
}

export async function cancelVisitAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.visits.cancel");
    const parsed = cancelVisitSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: visit, error: visitError } = await context.admin
      .from("technical_visits")
      .select("contract_id")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (visitError) throw visitError;
    if (!visit) throw new Error("Visita não encontrada.");

    const { error } = await context.admin
      .from("technical_visits")
      .update({ status: "cancelada", cancel_reason: parsed.data.cancel_reason })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);
    if (error) throw error;

    revalidateTechnical(String((visit as { contract_id: string }).contract_id));
    return ok("Visita cancelada sem excluir histórico.");
  } catch (error) {
    return fail(error);
  }
}

export async function updatePieceMeasurementAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.measurements.manage");
    const parsed = pieceMeasurementSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: piece, error: pieceError } = await context.admin
      .from("technical_contract_pieces")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (pieceError) throw pieceError;
    if (!piece) throw new Error("Peça não encontrada.");

    if ((piece as TechnicalPiece).released_at) {
      const canEditReleased = await hasContextPermission(context, "technical.pieces.edit_released");
      if (!canEditReleased) throw new Error("Peça liberada só pode ser editada por Gestor Técnico ou Administrador.");
    }

    const { error } = await context.admin
      .from("technical_contract_pieces")
      .update({
        measured_width_mm: parsed.data.measured_width_mm,
        measured_height_mm: parsed.data.measured_height_mm,
        notes: parsed.data.notes,
        status: "medida",
      })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);
    if (error) throw error;

    revalidateTechnical((piece as TechnicalPiece).contract_id);
    return ok("Medição registrada.");
  } catch (error) {
    return fail(error);
  }
}

export async function releasePieceAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.pieces.release");
    const parsed = releasePieceSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: piece, error: pieceError } = await context.admin
      .from("technical_contract_pieces")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (pieceError) throw pieceError;
    if (!piece) throw new Error("Peça não encontrada.");

    const { data: corrections, error: correctionsError } = await context.admin
      .from("technical_corrections")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("piece_id", parsed.data.id);
    if (correctionsError) throw correctionsError;

    const allowed = canReleasePiece({
      piece: piece as TechnicalPiece,
      corrections: (corrections ?? []) as TechnicalCorrection[],
    });
    if (!allowed.ok) throw new Error(allowed.reason ?? "Peça não pode ser liberada.");

    const releaseDate = new Date().toISOString();
    const releaseStartDate = releaseDate.slice(0, 10);
    const dueDate =
      parsed.data.exceptional_due_date ??
      addDeadlineDays({
        startDate: releaseStartDate,
        days: 10,
        unit: "dias_uteis",
      });

    const { error } = await context.admin
      .from("technical_contract_pieces")
      .update({
        status: "liberada",
        released_at: releaseDate,
        release_visit_id: parsed.data.visit_id,
        release_due_date: dueDate,
        exceptional_due_date: parsed.data.exceptional_due_date,
      })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);
    if (error) throw error;

    revalidateTechnical((piece as TechnicalPiece).contract_id);
    return ok("Peça liberada e prazo técnico iniciado.");
  } catch (error) {
    return fail(error);
  }
}

export async function updatePieceCemAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.prods.manage");
    const parsed = pieceCemSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: piece, error: pieceError } = await context.admin
      .from("technical_contract_pieces")
      .select("contract_id")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (pieceError) throw pieceError;
    if (!piece) throw new Error("Peça não encontrada.");

    const { error } = await context.admin
      .from("technical_contract_pieces")
      .update({ cem_registered: parsed.data.cem_registered, cem_checked: parsed.data.cem_checked })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);
    if (error) throw error;

    revalidateTechnical(String((piece as { contract_id: string }).contract_id));
    return ok("Informações do CEM atualizadas.");
  } catch (error) {
    return fail(error);
  }
}

export async function splitPieceAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.measurements.manage");
    const parsed = splitPieceSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: piece, error: pieceError } = await context.admin
      .from("technical_contract_pieces")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (pieceError) throw pieceError;
    if (!piece) throw new Error("Peça base não encontrada.");

    const source = piece as TechnicalPiece;
    const suffix = parsed.data.suffix.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const { error } = await context.admin.from("technical_contract_pieces").insert({
      company_id: context.companyId,
      contract_id: source.contract_id,
      parent_piece_id: source.id,
      code: `${source.code}_${suffix}`,
      piece_type: source.piece_type,
      quantity: Math.max(1, Math.trunc(parsed.data.quantity ?? source.quantity)),
      sale_width_mm: source.sale_width_mm,
      sale_height_mm: source.sale_height_mm,
      measured_width_mm: source.measured_width_mm,
      measured_height_mm: source.measured_height_mm,
      environment: source.environment,
      floor: source.floor,
      description: source.description,
      glass: source.glass,
      color: source.color,
      line: source.line,
      status: "medida",
      source: "split",
      notes: `Desdobrada a partir de ${source.code}.`,
    });
    if (error) throw error;

    revalidateTechnical(source.contract_id);
    return ok("Peça desdobrada criada como registro independente.");
  } catch (error) {
    return fail(error);
  }
}

export async function createCorrectionAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.corrections.manage");
    const parsed = correctionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await context.admin.from("technical_corrections").insert({
      company_id: context.companyId,
      ...parsed.data,
      status: "aberta",
    });
    if (error) throw error;

    if (parsed.data.piece_id) {
      await context.admin
        .from("technical_contract_pieces")
        .update({ status: "em_correcao" })
        .eq("company_id", context.companyId)
        .eq("id", parsed.data.piece_id);
    }

    revalidateTechnical(parsed.data.contract_id);
    return ok("Correção registrada.");
  } catch (error) {
    return fail(error);
  }
}

export async function closeCorrectionAction(first: ActionState | FormData, second?: FormData) {
  try {
    const formData = actionFormData(first, second);
    const context = await getActionContext("technical.corrections.manage");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Correção inválida.");

    const { data: correction, error: correctionError } = await context.admin
      .from("technical_corrections")
      .select("contract_id")
      .eq("company_id", context.companyId)
      .eq("id", id)
      .maybeSingle();
    if (correctionError) throw correctionError;
    if (!correction) throw new Error("Correção não encontrada.");

    const { error } = await context.admin
      .from("technical_corrections")
      .update({ status: "encerrada", closed_at: new Date().toISOString() })
      .eq("company_id", context.companyId)
      .eq("id", id);
    if (error) throw error;

    revalidateTechnical(String((correction as { contract_id: string }).contract_id));
    return ok("Correção encerrada.");
  } catch (error) {
    return fail(error);
  }
}

export async function createProdBatchAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.prods.manage");
    const parsed = prodBatchSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const pieceIds = idsFromForm(formData, "piece_ids");
    const { data: pieces, error: piecesError } = await context.admin
      .from("technical_contract_pieces")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("contract_id", parsed.data.contract_id)
      .in("id", pieceIds);
    if (piecesError) throw piecesError;

    if ((pieces ?? []).length !== pieceIds.length) throw new Error("Uma ou mais peças selecionadas não foram encontradas.");

    const typedPieces = (pieces ?? []) as TechnicalPiece[];
    const { data: corrections, error: correctionsError } = await context.admin
      .from("technical_corrections")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("contract_id", parsed.data.contract_id);
    if (correctionsError) throw correctionsError;
    const typedCorrections = (corrections ?? []) as TechnicalCorrection[];

    for (const piece of typedPieces) {
      const allowed = canAddPieceToProd({
        piece,
        activeProdBatchId: piece.active_prod_batch_id,
        corrections: typedCorrections.filter((correction) => correction.piece_id === piece.id),
      });
      if (!allowed.ok) throw new Error(`${piece.code}: ${allowed.reason}`);
    }

    const { data: prod, error } = await context.admin
      .from("technical_prod_batches")
      .insert({
        company_id: context.companyId,
        contract_id: parsed.data.contract_id,
        batch_number: parsed.data.batch_number,
        description: parsed.data.description,
        status: "aguardando_conferencia",
        cem_registered: true,
        cem_checked: true,
      })
      .select("id")
      .single();
    if (error) throw error;

    const prodBatchId = String((prod as { id: string }).id);
    const { error: linksError } = await context.admin.from("technical_prod_batch_pieces").insert(
      pieceIds.map((pieceId) => ({
        prod_batch_id: prodBatchId,
        piece_id: pieceId,
      })),
    );
    if (linksError) throw linksError;

    const { error: piecesUpdateError } = await context.admin
      .from("technical_contract_pieces")
      .update({ active_prod_batch_id: prodBatchId, status: "em_prod" })
      .eq("company_id", context.companyId)
      .in("id", pieceIds);
    if (piecesUpdateError) throw piecesUpdateError;

    revalidateTechnical(parsed.data.contract_id);
    return ok("PROD montado e enviado para conferência.");
  } catch (error) {
    return fail(error);
  }
}

export async function checkProdBatchAction(first: ActionState | FormData, second?: FormData) {
  try {
    const formData = actionFormData(first, second);
    const context = await getActionContext("technical.prods.check");
    const parsed = prodBatchTransitionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: prod, error: prodError } = await context.admin
      .from("technical_prod_batches")
      .select("contract_id")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (prodError) throw prodError;
    if (!prod) throw new Error("PROD não encontrado.");

    const { error } = await context.admin
      .from("technical_prod_batches")
      .update({
        status: "aguardando_aprovacao",
        checked_by_profile_id: context.profileId,
        checked_at: new Date().toISOString(),
      })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);
    if (error) throw error;

    revalidateTechnical(String((prod as { contract_id: string }).contract_id));
    return ok("PROD conferido.");
  } catch (error) {
    return fail(error);
  }
}

export async function approveProdBatchAction(first: ActionState | FormData, second?: FormData) {
  try {
    const formData = actionFormData(first, second);
    const context = await getActionContext("technical.prods.approve");
    const parsed = prodBatchTransitionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: prod, error: prodError } = await context.admin
      .from("technical_prod_batches")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (prodError) throw prodError;
    if (!prod) throw new Error("PROD não encontrado.");

    const typedProd = prod as TechnicalProdBatch;
    const allowed = canApproveProd({ prod: typedProd, isManager: true });
    if (!allowed.ok) throw new Error(allowed.reason ?? "PROD não pode ser aprovado.");

    const { data: pieces } = await context.admin
      .from("technical_prod_batch_pieces")
      .select("*, piece:technical_contract_pieces(*)")
      .eq("prod_batch_id", parsed.data.id);
    const snapshot = {
      prod: typedProd,
      pieces: pieces ?? [],
      approved_by_profile_id: context.profileId,
      approved_at: new Date().toISOString(),
    };

    const { error } = await context.admin
      .from("technical_prod_batches")
      .update({
        status: "aprovado",
        approved_by_profile_id: context.profileId,
        approved_at: new Date().toISOString(),
        approved_snapshot: snapshot,
      })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);
    if (error) throw error;

    revalidateTechnical(typedProd.contract_id);
    return ok("PROD aprovado.");
  } catch (error) {
    return fail(error);
  }
}

export async function deliverDepartmentDocumentAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.prods.manage");
    const parsed = deliverySchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const deliveryGate = canConfirmDepartmentDelivery({
      department: parsed.data.department,
      deliveryType: parsed.data.delivery_type,
    });
    if (!deliveryGate.ok) throw new Error(deliveryGate.reason ?? "Entrega departamental inválida.");

    const { data: prod, error: prodError } = await context.admin
      .from("technical_prod_batches")
      .select("contract_id")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.prod_batch_id)
      .maybeSingle();
    if (prodError) throw prodError;
    if (!prod) throw new Error("PROD não encontrado.");

    const now = new Date();
    const due = new Date(now);
    due.setHours(due.getHours() + 24);

    const { error } = await context.admin.from("technical_department_deliveries").insert({
      company_id: context.companyId,
      prod_batch_id: parsed.data.prod_batch_id,
      department: parsed.data.department,
      delivery_type: parsed.data.delivery_type,
      delivered_at: now.toISOString(),
      status: "entregue",
      confirmation_due_at: due.toISOString(),
      notes: parsed.data.notes,
    });
    if (error) throw error;

    revalidateTechnical(String((prod as { contract_id: string }).contract_id));
    return ok("Entrega registrada; confirmação pendente do departamento.");
  } catch (error) {
    return fail(error);
  }
}

export async function confirmDepartmentDeliveryAction(first: ActionState | FormData, second?: FormData) {
  try {
    const formData = actionFormData(first, second);
    const deliveryId = String(formData.get("id") ?? "");
    const department = String(formData.get("department") ?? "");
    const permission =
      department === "suprimentos"
        ? "technical.deliveries.suprimentos_confirm"
        : "technical.deliveries.producao_confirm";
    const context = await getActionContext(permission);

    if (!deliveryId) throw new Error("Entrega inválida.");

    const { data: delivery, error: deliveryError } = await context.admin
      .from("technical_department_deliveries")
      .select("*, prod:technical_prod_batches(contract_id)")
      .eq("company_id", context.companyId)
      .eq("id", deliveryId)
      .maybeSingle();
    if (deliveryError) throw deliveryError;
    if (!delivery) throw new Error("Entrega não encontrada.");

    const gate = canConfirmDepartmentDelivery({
      department: (delivery as { department: "suprimentos" | "producao" }).department,
      deliveryType: (delivery as { delivery_type: "lista_materiais" | "ordem_producao" }).delivery_type,
    });
    if (!gate.ok) throw new Error(gate.reason ?? "Confirmação inválida.");

    const { error } = await context.admin
      .from("technical_department_deliveries")
      .update({ status: "confirmado" })
      .eq("company_id", context.companyId)
      .eq("id", deliveryId);
    if (error) throw error;

    await context.admin.from("technical_department_confirmations").insert({
      company_id: context.companyId,
      delivery_id: deliveryId,
      confirmed_by_profile_id: context.profileId,
      confirmed_at: new Date().toISOString(),
      status: "confirmado",
    });

    const prod = (delivery as { prod?: { contract_id?: string } | null }).prod;
    revalidateTechnical(prod?.contract_id);
    return ok("Recebimento, conferência e aptidão confirmados.");
  } catch (error) {
    return fail(error);
  }
}

export async function createDoubtAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.doubts.manage");
    const parsed = doubtSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await context.admin.from("technical_doubts").insert({
      company_id: context.companyId,
      ...parsed.data,
      status: "aberta",
      asked_by_profile_id: context.profileId,
    });
    if (error) throw error;

    revalidateTechnical(parsed.data.contract_id ?? undefined);
    return ok("Dúvida registrada.");
  } catch (error) {
    return fail(error);
  }
}

export async function answerDoubtAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.doubts.manage");
    const parsed = answerDoubtSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: doubt, error: doubtError } = await context.admin
      .from("technical_doubts")
      .select("contract_id")
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (doubtError) throw doubtError;
    if (!doubt) throw new Error("Dúvida não encontrada.");

    const { error } = await context.admin
      .from("technical_doubts")
      .update({
        answer: parsed.data.answer,
        frequent: parsed.data.frequent,
        status: "respondida",
        answered_by_profile_id: context.profileId,
        answered_at: new Date().toISOString(),
      })
      .eq("company_id", context.companyId)
      .eq("id", parsed.data.id);
    if (error) throw error;

    revalidateTechnical((doubt as { contract_id?: string | null }).contract_id ?? undefined);
    return ok("Dúvida respondida.");
  } catch (error) {
    return fail(error);
  }
}

export async function requestProtectedDeletionAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.contracts.delete_request");
    const parsed = deletionRequestSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await context.admin.from("technical_deletion_requests").insert({
      company_id: context.companyId,
      entity: parsed.data.entity,
      entity_id: parsed.data.entity_id,
      reason: parsed.data.reason,
      status: "pendente",
      requested_by_profile_id: context.profileId,
    });
    if (error) throw error;

    revalidateTechnical();
    return ok("Solicitação de exclusão enviada ao Administrador.");
  } catch (error) {
    return fail(error);
  }
}

export async function approveDeletionRequestAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.permissions.manage");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Solicitação inválida.");

    const { data: request, error: requestError } = await context.admin
      .from("technical_deletion_requests")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("id", id)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) throw new Error("Solicitação não encontrada.");

    const tableByEntity: Record<string, string> = {
      technical_action: "technical_actions",
      technical_piece: "technical_contract_pieces",
      technical_correction: "technical_corrections",
      technical_prod: "technical_prod_batches",
      technical_contract: "technical_contracts",
    };
    const table = tableByEntity[String((request as { entity: string }).entity)];
    if (!table) throw new Error("Entidade não configurada para exclusão protegida.");

    const deletedAt = new Date().toISOString();
    const entityId = String((request as { entity_id: string }).entity_id);
    const { error: entityError } = await context.admin
      .from(table)
      .update({ deleted_at: deletedAt })
      .eq("company_id", context.companyId)
      .eq(table === "technical_contracts" ? "contract_id" : "id", entityId);
    if (entityError) throw entityError;

    const { error } = await context.admin
      .from("technical_deletion_requests")
      .update({
        status: "aprovada",
        reviewed_by_profile_id: context.profileId,
        reviewed_at: deletedAt,
      })
      .eq("company_id", context.companyId)
      .eq("id", id);
    if (error) throw error;

    revalidateTechnical();
    return ok("Exclusão lógica aprovada e auditada.");
  } catch (error) {
    return fail(error);
  }
}

export async function rejectDeletionRequestAction(_: ActionState, formData: FormData) {
  try {
    const context = await getActionContext("technical.permissions.manage");
    const id = String(formData.get("id") ?? "");
    const reviewerNotes = String(formData.get("reviewer_notes") ?? "").trim();
    if (!id) throw new Error("Solicitação inválida.");

    const { error } = await context.admin
      .from("technical_deletion_requests")
      .update({
        status: "rejeitada",
        reviewed_by_profile_id: context.profileId,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: reviewerNotes || null,
      })
      .eq("company_id", context.companyId)
      .eq("id", id);
    if (error) throw error;

    revalidateTechnical();
    return ok("Solicitação rejeitada.");
  } catch (error) {
    return fail(error);
  }
}

async function findManagedProfile(context: ActionContext, profileId: string) {
  const { data, error } = await context.admin
    .from("profiles")
    .select("*")
    .eq("company_id", context.companyId)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Usuário não encontrado.");

  return data as { id: string; user_id: string | null; email: string; name: string; status: string };
}

async function findManagedRole(context: ActionContext, roleId: string) {
  const { data, error } = await context.admin
    .from("roles")
    .select("*")
    .eq("company_id", context.companyId)
    .eq("id", roleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Nível de acesso não encontrado.");

  return data as { id: string; active: boolean; is_master_role: boolean; name: string };
}

export async function assignTechnicalUserRoleAction(_: ActionState, formData: FormData) {
  try {
    const context = await getMasterActionContext();
    const profileId = String(formData.get("profile_id") ?? "");
    const roleId = String(formData.get("role_id") ?? "");

    if (!profileId || !roleId) throw new Error("Informe o usuário e o nível de acesso.");

    const [profile, role] = await Promise.all([
      findManagedProfile(context, profileId),
      findManagedRole(context, roleId),
    ]);

    if (profile.status !== "active") throw new Error("Este cadastro está inativo.");
    if (!role.active) throw new Error("Este nível de acesso está inativo.");

    const { error } = await context.admin.from("user_roles").upsert(
      {
        company_id: context.companyId,
        profile_id: profile.id,
        role_id: role.id,
        active: true,
      },
      { onConflict: "company_id,profile_id,role_id" },
    );

    if (error) throw error;

    const now = new Date().toISOString();
    const { data: requests, error: requestError } = await context.admin
      .from("access_review_requests")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: context.authUserId,
      })
      .eq("company_id", context.companyId)
      .eq("profile_id", profile.id)
      .eq("status", "pending")
      .select("id");

    if (requestError) throw requestError;

    const requestIds = ((requests ?? []) as Array<{ id: string }>).map((request) => request.id);
    if (requestIds.length) {
      const { error: notificationError } = await context.admin
        .from("platform_notifications")
        .update({ read_at: now })
        .eq("company_id", context.companyId)
        .eq("entity", "access_review_request")
        .in("entity_id", requestIds);

      if (notificationError) throw notificationError;
    }

    revalidateTechnical();
    return ok("Nível de acesso vinculado ao usuário.");
  } catch (error) {
    return fail(error, "Não foi possível liberar o acesso.");
  }
}

export async function removeTechnicalUserRoleAction(_: ActionState, formData: FormData) {
  try {
    const context = await getMasterActionContext();
    const userRoleId = String(formData.get("user_role_id") ?? "");
    if (!userRoleId) throw new Error("Vínculo de acesso inválido.");

    const { data: userRole, error: userRoleError } = await context.admin
      .from("user_roles")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("id", userRoleId)
      .maybeSingle();

    if (userRoleError) throw userRoleError;
    if (!userRole) throw new Error("Vínculo de acesso não encontrado.");

    const role = await findManagedRole(context, String((userRole as { role_id: string }).role_id));
    if ((userRole as { profile_id: string }).profile_id === context.profileId && role.is_master_role) {
      throw new Error("Você não pode remover seu próprio nível Administrador.");
    }

    const { error } = await context.admin.from("user_roles").delete().eq("id", userRoleId);
    if (error) throw error;

    revalidateTechnical();
    return ok("Nível de acesso removido.");
  } catch (error) {
    return fail(error, "Não foi possível remover o nível de acesso.");
  }
}

export async function setTechnicalProfileStatusAction(_: ActionState, formData: FormData) {
  try {
    const context = await getMasterActionContext();
    const profileId = String(formData.get("profile_id") ?? "");
    const status = String(formData.get("status") ?? "");

    if (!profileId || (status !== "active" && status !== "inactive")) {
      throw new Error("Dados inválidos para alterar o usuário.");
    }

    const profile = await findManagedProfile(context, profileId);
    if (profile.id === context.profileId && status === "inactive") {
      throw new Error("Você não pode inativar o próprio cadastro.");
    }

    const { error } = await context.admin
      .from("profiles")
      .update({ status })
      .eq("company_id", context.companyId)
      .eq("id", profile.id);

    if (error) throw error;

    revalidateTechnical();
    return ok(status === "active" ? "Usuário reativado." : "Usuário inativado.");
  } catch (error) {
    return fail(error, "Não foi possível alterar o usuário.");
  }
}

export async function rejectTechnicalAccessRequestAction(_: ActionState, formData: FormData) {
  try {
    const context = await getMasterActionContext();
    const profileId = String(formData.get("profile_id") ?? "");
    if (!profileId) throw new Error("Usuário inválido.");

    const profile = await findManagedProfile(context, profileId);
    if (profile.id === context.profileId || profile.user_id === context.authUserId) {
      throw new Error("Você não pode excluir o próprio cadastro.");
    }

    const { data: requests, error: requestsError } = await context.admin
      .from("access_review_requests")
      .select("id")
      .eq("company_id", context.companyId)
      .eq("profile_id", profile.id);

    if (requestsError) throw requestsError;

    const requestIds = ((requests ?? []) as Array<{ id: string }>).map((request) => request.id);
    if (requestIds.length) {
      const { error: notificationError } = await context.admin
        .from("platform_notifications")
        .delete()
        .eq("company_id", context.companyId)
        .eq("entity", "access_review_request")
        .in("entity_id", requestIds);

      if (notificationError) throw notificationError;
    }

    const { error: metadataNotificationError } = await context.admin
      .from("platform_notifications")
      .delete()
      .eq("company_id", context.companyId)
      .eq("metadata->>profile_id", profile.id);

    if (metadataNotificationError) throw metadataNotificationError;

    if (profile.user_id) {
      const { error: deleteAuthError } = await context.admin.auth.admin.deleteUser(profile.user_id);
      if (deleteAuthError) throw deleteAuthError;
    }

    const { error: deleteProfileError } = await context.admin
      .from("profiles")
      .delete()
      .eq("company_id", context.companyId)
      .eq("id", profile.id);

    if (deleteProfileError) throw deleteProfileError;

    revalidateTechnical();
    return ok("Cadastro recusado e removido.");
  } catch (error) {
    return fail(error, "Não foi possível recusar o cadastro.");
  }
}

export async function guardUnhandledAction() {
  throw new HttpError(400, "Ação não implementada.");
}

const emptyActionState: ActionState = { ok: false, message: "" };

export async function assignTechnicalUserRoleFormAction(formData: FormData) {
  await assignTechnicalUserRoleAction(emptyActionState, formData);
}

export async function removeTechnicalUserRoleFormAction(formData: FormData) {
  await removeTechnicalUserRoleAction(emptyActionState, formData);
}

export async function setTechnicalProfileStatusFormAction(formData: FormData) {
  await setTechnicalProfileStatusAction(emptyActionState, formData);
}

export async function rejectTechnicalAccessRequestFormAction(formData: FormData) {
  await rejectTechnicalAccessRequestAction(emptyActionState, formData);
}

export async function transitionTechnicalActionFormAction(formData: FormData) {
  await transitionTechnicalActionAction(formData);
}

export async function generateVisitReportFormAction(formData: FormData) {
  await generateVisitReportAction(formData);
}

export async function closeCorrectionFormAction(formData: FormData) {
  await closeCorrectionAction(formData);
}

export async function checkProdBatchFormAction(formData: FormData) {
  await checkProdBatchAction(formData);
}

export async function approveProdBatchFormAction(formData: FormData) {
  await approveProdBatchAction(formData);
}

export async function confirmDepartmentDeliveryFormAction(formData: FormData) {
  await confirmDepartmentDeliveryAction(formData);
}
