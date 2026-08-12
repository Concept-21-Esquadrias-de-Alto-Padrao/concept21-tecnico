import { z } from "zod";
import {
  DEADLINE_UNITS,
  DEPARTMENT_KEYS,
  PRIORITIES,
  TECHNICAL_CONTRACT_STAGE_KEYS,
  TECHNICAL_DOUBT_AREAS,
} from "@/lib/types";

export function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value ? value : null))
  .optional()
  .nullable();

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : null));

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  });

const checkboxBoolean = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()])
  .transform((value) => value === "on" || value === "true");

export const manualContractSchema = z.object({
  contract_number: z.string().trim().min(1, "Informe o número do contrato."),
  client_name: z.string().trim().min(1, "Informe o cliente."),
  work_name: z.string().trim().min(1, "Informe a obra."),
  full_address: z.string().trim().min(1, "Informe o endereço da obra."),
  city: z.string().trim().default("Goiânia"),
  state: z.string().trim().default("GO"),
  contract_date: optionalDate,
  contractual_deadline_value: optionalNumber,
  contractual_deadline_unit: z.enum(DEADLINE_UNITS).default("dias_uteis"),
  technical_manager_profile_id: optionalText,
  followup_profile_id: optionalText,
  description: optionalText,
});

export const confirmedImportSchema = z.object({
  contract_json: z.string().min(2),
  pieces_json: z.string().min(2),
  reprocess_existing: checkboxBoolean.default(false),
});

export const receiveFolderSchema = z.object({
  contract_id: z.string().uuid(),
  folder_received_at: z.string().min(1, "Informe a data da entrega."),
  folder_delivered_by: z.string().trim().min(1, "Informe quem entregou a pasta."),
  technical_notes: optionalText,
});

export const reopenContractStageSchema = z.object({
  contract_id: z.string().uuid(),
  stage: z.enum(["entrada_comercial", "reuniao_ata"]),
  reason: z.string().trim().min(5, "Informe o motivo da reabertura."),
});

export const workDataCorrectionSchema = z.object({
  id: z.string().uuid(),
  work_name: z.string().trim().min(1, "Informe a obra."),
  full_address: z.string().trim().min(1, "Informe o endereço da obra."),
  city: z.string().trim().min(1, "Informe a cidade."),
  state: z
    .string()
    .trim()
    .min(2, "Informe a UF.")
    .max(2, "Informe a UF com 2 letras.")
    .transform((value) => value.toUpperCase()),
  zip_code: optionalText,
  site_contact: optionalText,
  site_contact_phone: optionalText,
  notes: optionalText,
  adjustment_reason: z.string().trim().min(5, "Informe o motivo do ajuste."),
});

export const meetingSchema = z.object({
  contract_id: z.string().uuid(),
  meeting_date: z.string().min(1, "Informe a data."),
  meeting_time: optionalText,
  participants: z.string().trim().min(1, "Informe participantes."),
  summary: optionalText,
  decisions: optionalText,
  blockers: optionalText,
  create_action_title: optionalText,
  create_action_due_date: optionalDate,
});

export const stageValidationSchema = z.object({
  contract_id: z.string().uuid(),
  stage: z.enum(TECHNICAL_CONTRACT_STAGE_KEYS),
  validation_required: checkboxBoolean,
});

export const stageSignatureSchema = z.object({
  contract_id: z.string().uuid(),
  stage: z.enum(TECHNICAL_CONTRACT_STAGE_KEYS),
});

export const actionSchema = z.object({
  contract_id: z.string().uuid(),
  meeting_id: optionalText,
  title: z.string().trim().min(1, "Informe o título da ação."),
  description: optionalText,
  responsible_profile_id: optionalText,
  due_date: optionalDate,
  priority: z.enum(PRIORITIES).default("normal"),
  blocking: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()])
    .transform((value) => value === "on" || value === "true"),
  blocking_stage: optionalText,
});

export const actionTransitionSchema = z.object({
  id: z.string().uuid(),
  next_status: z.enum(["em_andamento", "concluida", "validada", "cancelada", "aberta"]),
});

export const visitSchema = z.object({
  contract_id: z.string().uuid(),
  visit_type: z.string().trim().min(1, "Informe o tipo de visita."),
  scheduled_date: z.string().min(1, "Informe a data da visita."),
  scheduled_time: optionalText,
  technicians: z.string().trim().min(1, "Informe técnico(s)."),
  objectives: z.string().trim().min(1, "Informe objetivo(s)."),
  piece_ids: optionalText,
});

export const visitResultSchema = z.object({
  id: z.string().uuid(),
  performed_at: z.string().min(1, "Informe a data/hora realizada."),
  accompanied_by: optionalText,
  result_summary: z.string().trim().min(1, "Informe o resultado da visita."),
});

export const cancelVisitSchema = z.object({
  id: z.string().uuid(),
  cancel_reason: z.string().trim().min(1, "Informe o motivo do cancelamento."),
});

export const pieceMeasurementSchema = z.object({
  id: z.string().uuid(),
  measured_width_mm: optionalNumber,
  measured_height_mm: optionalNumber,
  notes: optionalText,
});

export const pieceRegistrationSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().min(1, "Informe o código da peça."),
  piece_type: optionalText,
  environment: optionalText,
  sale_width_mm: optionalNumber,
  sale_height_mm: optionalNumber,
  adjustment_reason: z.string().trim().min(5, "Informe o motivo do ajuste."),
});

export const splitPieceSchema = z.object({
  id: z.string().uuid(),
  suffix: z.string().trim().min(1, "Informe o sufixo da peça desdobrada."),
  quantity: optionalNumber,
});

export const pieceCemSchema = z.object({
  id: z.string().uuid(),
  cem_registered: z.union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()]).transform((value) => value === "on" || value === "true"),
  cem_checked: z.union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()]).transform((value) => value === "on" || value === "true"),
});

export const releasePieceSchema = z.object({
  id: z.string().uuid(),
  visit_id: optionalText,
  exceptional_due_date: optionalDate,
});

export const correctionSchema = z.object({
  contract_id: z.string().uuid(),
  piece_id: optionalText,
  prod_batch_id: optionalText,
  type: z.string().trim().min(1, "Informe o tipo da correção."),
  description: z.string().trim().min(1, "Informe a descrição."),
  responsible_profile_id: optionalText,
  due_date: optionalDate,
  priority: z.enum(PRIORITIES).default("normal"),
  blocking: z.union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()]).transform((value) => value === "on" || value === "true"),
  critical: z.union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()]).transform((value) => value === "on" || value === "true"),
  impact: optionalText,
});

export const prodBatchSchema = z.object({
  contract_id: z.string().uuid(),
  batch_number: z.string().trim().min(1, "Informe o número do PROD."),
  description: optionalText,
  piece_ids: z.string().trim().min(1, "Selecione peças para o PROD."),
});

export const prodBatchTransitionSchema = z.object({
  id: z.string().uuid(),
});

export const deliverySchema = z.object({
  prod_batch_id: z.string().uuid(),
  department: z.enum(DEPARTMENT_KEYS),
  delivery_type: z.enum(["lista_materiais", "ordem_producao"]),
  notes: optionalText,
});

export const doubtSchema = z.object({
  area: z.enum(TECHNICAL_DOUBT_AREAS),
  contract_id: optionalText,
  piece_id: optionalText,
  prod_batch_id: optionalText,
  category: optionalText,
  question: z.string().trim().min(1, "Informe a dúvida."),
});

export const answerDoubtSchema = z.object({
  id: z.string().uuid(),
  answer: z.string().trim().min(1, "Informe a resposta."),
  frequent: z.union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()]).transform((value) => value === "on" || value === "true"),
});

export const deletionRequestSchema = z.object({
  entity: z.string().trim().min(1),
  entity_id: z.string().uuid(),
  reason: z.string().trim().min(1, "Informe a justificativa."),
});
