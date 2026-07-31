import type {
  DepartmentKey,
  LabelMap,
  Priority,
  TechnicalActionStatus,
  TechnicalContractStatus,
  TechnicalCorrectionStatus,
  TechnicalDoubtArea,
  TechnicalPieceStatus,
  TechnicalProdStatus,
  TechnicalVisitStatus,
} from "@/lib/types";

export const technicalContractStatusLabels: LabelMap<TechnicalContractStatus> = {
  aguardando_pasta: "Aguardando pasta",
  aguardando_reuniao: "Aguardando reunião",
  em_acompanhamento: "Em acompanhamento",
  aguardando_visita: "Aguardando visita",
  em_medicao: "Em medição",
  em_liberacao: "Em liberação",
  em_prod: "Em PROD",
  repassado: "Repassado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const technicalActionStatusLabels: LabelMap<TechnicalActionStatus> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  validada: "Validada",
  cancelada: "Cancelada",
};

export const technicalVisitStatusLabels: LabelMap<TechnicalVisitStatus> = {
  agendada: "Agendada",
  realizada: "Realizada",
  aguardando_relatorio: "Aguardando relatório",
  relatorio_emitido: "Relatório emitido",
  cancelada: "Cancelada",
};

export const technicalPieceStatusLabels: LabelMap<TechnicalPieceStatus> = {
  aguardando_avaliacao: "Aguardando avaliação",
  avaliada: "Avaliada",
  medida: "Medida",
  liberada: "Liberada",
  em_correcao: "Em correção",
  em_prod: "Em PROD",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export const technicalCorrectionStatusLabels: LabelMap<TechnicalCorrectionStatus> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aguardando_validacao: "Aguardando validação",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export const technicalProdStatusLabels: LabelMap<TechnicalProdStatus> = {
  rascunho: "Rascunho",
  aguardando_cem: "Aguardando CEM",
  aguardando_conferencia: "Aguardando conferência",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  devolvido: "Devolvido",
  entregue_suprimentos: "Entregue a Suprimentos",
  entregue_producao: "Entregue à Produção",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const priorityLabels: LabelMap<Priority> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const departmentLabels: LabelMap<DepartmentKey> = {
  suprimentos: "Suprimentos",
  producao: "Produção",
};

export const doubtAreaLabels: LabelMap<TechnicalDoubtArea> = {
  producao: "Dúvidas da Produção",
  obras_instalacoes: "Dúvidas de Obras/Instalações",
};
