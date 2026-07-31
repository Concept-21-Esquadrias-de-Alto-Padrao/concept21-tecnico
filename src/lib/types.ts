export const TECHNICAL_CONTRACT_STATUSES = [
  "aguardando_pasta",
  "aguardando_reuniao",
  "em_acompanhamento",
  "aguardando_visita",
  "em_medicao",
  "em_liberacao",
  "em_prod",
  "repassado",
  "concluido",
  "cancelado",
] as const;

export const TECHNICAL_ACTION_STATUSES = [
  "aberta",
  "em_andamento",
  "concluida",
  "validada",
  "cancelada",
] as const;

export const TECHNICAL_VISIT_STATUSES = [
  "agendada",
  "realizada",
  "aguardando_relatorio",
  "relatorio_emitido",
  "cancelada",
] as const;

export const TECHNICAL_PIECE_STATUSES = [
  "aguardando_avaliacao",
  "avaliada",
  "medida",
  "liberada",
  "em_correcao",
  "em_prod",
  "entregue",
  "cancelada",
] as const;

export const TECHNICAL_CORRECTION_STATUSES = [
  "aberta",
  "em_andamento",
  "aguardando_validacao",
  "encerrada",
  "cancelada",
] as const;

export const TECHNICAL_PROD_STATUSES = [
  "rascunho",
  "aguardando_cem",
  "aguardando_conferencia",
  "aguardando_aprovacao",
  "aprovado",
  "devolvido",
  "entregue_suprimentos",
  "entregue_producao",
  "concluido",
  "cancelado",
] as const;

export const TECHNICAL_DOUBT_AREAS = ["producao", "obras_instalacoes"] as const;
export const DEPARTMENT_KEYS = ["suprimentos", "producao"] as const;
export const PRIORITIES = ["baixa", "normal", "alta", "urgente"] as const;
export const DEADLINE_UNITS = ["dias_uteis", "dias_corridos"] as const;

export type TechnicalContractStatus = (typeof TECHNICAL_CONTRACT_STATUSES)[number];
export type TechnicalActionStatus = (typeof TECHNICAL_ACTION_STATUSES)[number];
export type TechnicalVisitStatus = (typeof TECHNICAL_VISIT_STATUSES)[number];
export type TechnicalPieceStatus = (typeof TECHNICAL_PIECE_STATUSES)[number];
export type TechnicalCorrectionStatus = (typeof TECHNICAL_CORRECTION_STATUSES)[number];
export type TechnicalProdStatus = (typeof TECHNICAL_PROD_STATUSES)[number];
export type TechnicalDoubtArea = (typeof TECHNICAL_DOUBT_AREAS)[number];
export type DepartmentKey = (typeof DEPARTMENT_KEYS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type DeadlineUnit = (typeof DEADLINE_UNITS)[number];

export type LabelMap<T extends string> = Record<T, string>;

export type Profile = {
  id: string;
  company_id: string;
  user_id: string | null;
  name: string;
  email: string;
  title: string | null;
  department_id: string | null;
  status: "active" | "inactive";
  avatar_url: string | null;
  is_master: boolean;
  permissions?: string[] | null;
};

export type Permission = {
  id: string;
  key: string;
  description: string;
};

export type Role = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_master_role: boolean;
  active: boolean;
};

export type UserRole = {
  id: string;
  company_id: string;
  profile_id: string;
  role_id: string;
  active?: boolean;
};

export type PlatformNotification = {
  id: string;
  recipient_profile_id: string | null;
  recipient_auth_user_id: string | null;
  title: string;
  body: string;
  category: string;
  entity: string | null;
  entity_id: string | null;
  action_url: string | null;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Client = {
  id: string;
  company_id: string;
  name: string;
  trade_name: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
};

export type ProductionContract = {
  id: string;
  company_id: string;
  contract_number: string;
  client_id: string;
  work_name: string;
  full_address: string;
  street: string | null;
  block: string | null;
  lot: string | null;
  sector: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  site_contact: string | null;
  site_contact_phone: string | null;
  general_delivery_forecast: string | null;
  notes: string | null;
  status: string;
  active: boolean;
};

export type TechnicalContract = {
  contract_id: string;
  company_id: string;
  contract_date: string | null;
  contractual_deadline_value: number | null;
  contractual_deadline_unit: DeadlineUnit;
  technical_status: TechnicalContractStatus;
  technical_manager_profile_id: string | null;
  followup_profile_id: string | null;
  commercial_folder_received: boolean;
  folder_received_at: string | null;
  folder_delivered_by: string | null;
  folder_received_by_profile_id: string | null;
  commercial_data: Record<string, unknown>;
  authorized_contacts: Array<Record<string, unknown>>;
  technical_notes: string | null;
  risk_status: "normal" | "atencao" | "risco" | "atrasado";
  risk_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalPiece = {
  id: string;
  company_id: string;
  contract_id: string;
  production_piece_id: string | null;
  code: string;
  parent_piece_id: string | null;
  piece_type: string | null;
  quantity: number;
  sale_width_mm: number | null;
  sale_height_mm: number | null;
  measured_width_mm: number | null;
  measured_height_mm: number | null;
  environment: string | null;
  floor: string | null;
  description: string | null;
  glass: string | null;
  color: string | null;
  line: string | null;
  status: TechnicalPieceStatus;
  released_at: string | null;
  release_visit_id: string | null;
  release_due_date: string | null;
  exceptional_due_date: string | null;
  cem_registered: boolean;
  cem_checked: boolean;
  active_prod_batch_id: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalMeeting = {
  id: string;
  company_id: string;
  contract_id: string;
  meeting_date: string;
  meeting_time: string | null;
  participants: string[];
  summary: string | null;
  decisions: string | null;
  blockers: string | null;
  status: "rascunho" | "concluida" | "cancelada";
  registered_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalAction = {
  id: string;
  company_id: string;
  contract_id: string;
  meeting_id: string | null;
  title: string;
  description: string | null;
  responsible_profile_id: string | null;
  due_date: string | null;
  priority: Priority;
  blocking: boolean;
  blocking_stage: string | null;
  status: TechnicalActionStatus;
  completed_at: string | null;
  validated_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalVisit = {
  id: string;
  company_id: string;
  contract_id: string;
  visit_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  performed_at: string | null;
  technicians: string[];
  accompanied_by: string | null;
  objectives: string[];
  result_summary: string | null;
  report_required: boolean;
  report_generated_at: string | null;
  report_sent_at: string | null;
  report_snapshot: Record<string, unknown> | null;
  status: TechnicalVisitStatus;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalVisitPiece = {
  id: string;
  visit_id: string;
  piece_id: string;
  objective: string | null;
  result: string | null;
};

export type TechnicalCorrection = {
  id: string;
  company_id: string;
  contract_id: string;
  piece_id: string | null;
  prod_batch_id: string | null;
  type: string;
  description: string;
  responsible_profile_id: string | null;
  due_date: string | null;
  priority: Priority;
  blocking: boolean;
  critical: boolean;
  impact: string | null;
  status: TechnicalCorrectionStatus;
  closed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalProdBatch = {
  id: string;
  company_id: string;
  contract_id: string;
  batch_number: string;
  description: string | null;
  status: TechnicalProdStatus;
  cem_registered: boolean;
  cem_checked: boolean;
  checked_by_profile_id: string | null;
  checked_at: string | null;
  approved_by_profile_id: string | null;
  approved_at: string | null;
  approved_snapshot: Record<string, unknown> | null;
  correction_round: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalProdBatchPiece = {
  id: string;
  prod_batch_id: string;
  piece_id: string;
};

export type TechnicalProdDocument = {
  id: string;
  company_id: string;
  prod_batch_id: string;
  document_type: "lista_materiais" | "ordem_producao" | "planilha_resumo";
  status: "rascunho" | "emitido" | "conferido" | "aprovado" | "entregue" | "corrigido" | "cancelado";
  generated_at: string | null;
  sent_at: string | null;
  structured_snapshot: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalDepartmentDelivery = {
  id: string;
  company_id: string;
  prod_batch_id: string;
  department: DepartmentKey;
  delivery_type: "lista_materiais" | "ordem_producao";
  delivered_at: string | null;
  status: "pendente" | "entregue" | "confirmado" | "recusado" | "devolvido";
  confirmation_due_at: string | null;
  last_notification_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalDoubt = {
  id: string;
  company_id: string;
  area: TechnicalDoubtArea;
  contract_id: string | null;
  piece_id: string | null;
  prod_batch_id: string | null;
  category: string | null;
  question: string;
  answer: string | null;
  status: "aberta" | "respondida" | "encerrada";
  frequent: boolean;
  asked_by_profile_id: string | null;
  answered_by_profile_id: string | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalAuditLog = {
  id: string;
  company_id: string;
  entity: string;
  entity_id: string;
  action: string;
  user_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

export type TechnicalContractOverview = {
  contract: ProductionContract;
  client: Client | null;
  technical: TechnicalContract | null;
  pieces: TechnicalPiece[];
  actions: TechnicalAction[];
  visits: TechnicalVisit[];
  corrections: TechnicalCorrection[];
  prodBatches: TechnicalProdBatch[];
  doubts: TechnicalDoubt[];
};

export type TechnicalSnapshot = {
  source: "supabase" | "empty";
  clients: Client[];
  profiles: Profile[];
  contracts: ProductionContract[];
  technicalContracts: TechnicalContract[];
  pieces: TechnicalPiece[];
  meetings: TechnicalMeeting[];
  actions: TechnicalAction[];
  visits: TechnicalVisit[];
  visitPieces: TechnicalVisitPiece[];
  corrections: TechnicalCorrection[];
  prodBatches: TechnicalProdBatch[];
  prodBatchPieces: TechnicalProdBatchPiece[];
  prodDocuments: TechnicalProdDocument[];
  deliveries: TechnicalDepartmentDelivery[];
  doubts: TechnicalDoubt[];
  notifications: PlatformNotification[];
  auditLogs: TechnicalAuditLog[];
};
