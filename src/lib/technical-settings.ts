import { requirePermissionAccess } from "@/lib/server-access";
import type {
  TechnicalDoubtArea,
  TechnicalDoubtCategory,
  TechnicalHoliday,
  TechnicalSetting,
} from "@/lib/types";

export const listSettingDefinitions = [
  {
    key: "tipos_visita",
    title: "Tipos de visita",
    description: "Opções usadas para classificar visitas técnicas.",
    defaultItems: ["Inicial", "Medição", "Conferência", "Retorno", "Correção"],
  },
  {
    key: "tipos_acao",
    title: "Tipos de ação",
    description: "Classificações internas para ações e pendências técnicas.",
    defaultItems: ["Pendência técnica", "Validação", "Acompanhamento", "Solicitação interna"],
  },
  {
    key: "tipos_correcao",
    title: "Tipos de correção",
    description: "Classificações usadas no registro de correções.",
    defaultItems: ["Medida", "Material", "Projeto", "Instalação", "Acabamento"],
  },
  {
    key: "impactos",
    title: "Impactos",
    description: "Impactos possíveis para correções, bloqueios e riscos.",
    defaultItems: ["Baixo", "Médio", "Alto", "Bloqueia produção", "Bloqueia instalação"],
  },
  {
    key: "motivos_cancelamento",
    title: "Motivos de cancelamento",
    description: "Motivos padronizados para cancelamento de visitas e ações.",
    defaultItems: ["Cliente indisponível", "Equipe indisponível", "Condição de obra", "Replanejamento interno"],
  },
  {
    key: "prioridades",
    title: "Prioridades",
    description: "Ordem e rótulos operacionais das prioridades do módulo.",
    defaultItems: ["baixa", "normal", "alta", "urgente"],
  },
  {
    key: "tipos_materiais",
    title: "Tipos de materiais",
    description: "Tipos de materiais usados em documentos e acompanhamento técnico.",
    defaultItems: ["Alumínio", "Vidro", "Ferragens", "Vedação", "Acessórios"],
  },
  {
    key: "categorias_documentos",
    title: "Parâmetros de relatórios",
    description: "Categorias de documentos e saídas usadas nos relatórios técnicos.",
    defaultItems: ["lista_materiais", "ordem_producao", "planilha_resumo", "relatorio_visita"],
  },
] as const;

export const deadlineSettingDefinitions = [
  {
    key: "prazo_tecnico_dias_uteis",
    label: "Prazo técnico",
    description: "Prazo Técnico padrão em dias úteis",
    defaultValue: 10,
  },
  {
    key: "prazo_suprimentos_dias_uteis",
    label: "Prazo Suprimentos",
    description: "Prazo Suprimentos em dias úteis",
    defaultValue: 35,
  },
  {
    key: "prazo_producao_dias_uteis",
    label: "Prazo Produção",
    description: "Prazo Produção em dias úteis",
    defaultValue: 15,
  },
] as const;

export const riskBandDefinitions = [
  { key: "atencao", label: "Atenção", defaultValue: 70 },
  { key: "risco", label: "Risco", defaultValue: 90 },
  { key: "atrasado", label: "Atrasado", defaultValue: 100 },
] as const;

export const notificationSettingDefinition = {
  key: "parametros_notificacao",
  title: "Parâmetros de notificação",
  description: "Preferências gerais para alertas e lembretes do módulo Técnico.",
  defaultValue: {
    intervalo_reenvio_horas: 24,
    notificar_pendencias_entrega: true,
  },
} as const;

export const editableSettingKeys = new Set<string>([
  ...listSettingDefinitions.map((definition) => definition.key),
  ...deadlineSettingDefinitions.map((definition) => definition.key),
  "faixas_risco",
  notificationSettingDefinition.key,
]);

export const technicalDoubtAreaOptions: Array<{ value: TechnicalDoubtArea; label: string }> = [
  { value: "producao", label: "Produção" },
  { value: "obras_instalacoes", label: "Obras/Instalações" },
];

export function settingValue<T>(settings: TechnicalSetting[], key: string, fallback: T): T {
  const setting = settings.find((item) => item.key === key);
  return setting?.value === undefined || setting?.value === null ? fallback : (setting.value as T);
}

export type TechnicalSettingsData = {
  settings: TechnicalSetting[];
  doubtCategories: TechnicalDoubtCategory[];
  holidays: TechnicalHoliday[];
};

export async function getTechnicalSettingsData(): Promise<TechnicalSettingsData> {
  const context = await requirePermissionAccess(
    "technical.settings.manage",
    "Você não possui permissão para alterar cadastros e parâmetros.",
  );

  const [settingsResult, categoriesResult, holidaysResult] = await Promise.all([
    context.admin
      .from("technical_settings")
      .select("*")
      .eq("company_id", context.profile.company_id)
      .order("key", { ascending: true }),
    context.admin
      .from("technical_doubt_categories")
      .select("*")
      .eq("company_id", context.profile.company_id)
      .order("area", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    context.admin
      .from("technical_holidays")
      .select("*")
      .eq("company_id", context.profile.company_id)
      .order("holiday_date", { ascending: true }),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (categoriesResult.error) throw categoriesResult.error;
  if (holidaysResult.error) throw holidaysResult.error;

  return {
    settings: (settingsResult.data ?? []) as TechnicalSetting[],
    doubtCategories: (categoriesResult.data ?? []) as TechnicalDoubtCategory[],
    holidays: (holidaysResult.data ?? []) as TechnicalHoliday[],
  };
}
