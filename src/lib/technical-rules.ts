import type {
  DepartmentKey,
  TechnicalAction,
  TechnicalContract,
  TechnicalCorrection,
  TechnicalPiece,
  TechnicalProdBatch,
  TechnicalVisit,
} from "@/lib/types";

export type CalendarHoliday = {
  date: string;
  scope?: "nacional" | "estadual" | "municipal";
};

export function addDeadlineDays({
  startDate,
  days,
  unit,
  holidays = [],
}: {
  startDate: string;
  days: number;
  unit: "dias_uteis" | "dias_corridos";
  holidays?: CalendarHoliday[];
}) {
  const start = new Date(`${startDate}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return null;
  if (days <= 0) return startDate;

  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const current = new Date(start);
  let remaining = days;

  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    const iso = current.toISOString().slice(0, 10);
    const weekday = current.getDay();
    const businessDay = weekday !== 0 && weekday !== 6 && !holidayDates.has(iso);

    if (unit === "dias_corridos" || businessDay) {
      remaining -= 1;
    }
  }

  return current.toISOString().slice(0, 10);
}

export function canScheduleInitialVisit({
  technical,
  actions,
}: {
  technical: Pick<TechnicalContract, "commercial_folder_received"> | null;
  actions: Array<Pick<TechnicalAction, "blocking" | "blocking_stage" | "status">>;
}) {
  if (!technical?.commercial_folder_received) {
    return { ok: false, reason: "A pasta comercial precisa estar registrada como entregue." };
  }

  const hasBlockingInitialAction = actions.some(
    (action) =>
      action.blocking &&
      (!action.blocking_stage || action.blocking_stage === "entrada_inicial") &&
      !["concluida", "validada", "cancelada"].includes(action.status),
  );

  if (hasBlockingInitialAction) {
    return { ok: false, reason: "Existe ação bloqueante da etapa inicial em aberto." };
  }

  return { ok: true, reason: null };
}

export function hasPerformedMeeting(meetings: Array<{ status: string }>) {
  return meetings.some((meeting) => meeting.status === "concluida");
}

export function canAdvanceToVisit({
  technical,
  meetings,
  actions,
}: {
  technical: Pick<TechnicalContract, "commercial_folder_received"> | null;
  meetings: Array<{ status: string }>;
  actions: Array<Pick<TechnicalAction, "blocking" | "blocking_stage" | "status">>;
}) {
  const folder = canScheduleInitialVisit({ technical, actions });
  if (!folder.ok) return folder;
  if (!hasPerformedMeeting(meetings)) {
    return { ok: false, reason: "A reunião de fechamento precisa estar registrada." };
  }
  return { ok: true, reason: null };
}

export function canReleasePiece({
  piece,
  corrections,
}: {
  piece: Pick<TechnicalPiece, "measured_width_mm" | "measured_height_mm" | "status">;
  corrections: Array<Pick<TechnicalCorrection, "blocking" | "status">>;
}) {
  if (!piece.measured_width_mm || !piece.measured_height_mm) {
    return { ok: false, reason: "A peça precisa estar medida antes da liberação." };
  }

  const hasBlockingCorrection = corrections.some(
    (correction) =>
      correction.blocking && !["encerrada", "cancelada"].includes(correction.status),
  );

  if (hasBlockingCorrection) {
    return { ok: false, reason: "Correção bloqueante aberta impede a liberação." };
  }

  if (piece.status === "cancelada") {
    return { ok: false, reason: "Peça cancelada não pode ser liberada." };
  }

  return { ok: true, reason: null };
}

export function canAddPieceToProd({
  piece,
  activeProdBatchId,
  corrections,
}: {
  piece: Pick<TechnicalPiece, "released_at" | "cem_registered" | "cem_checked" | "status">;
  activeProdBatchId?: string | null;
  corrections: Array<Pick<TechnicalCorrection, "blocking" | "status">>;
}) {
  if (!piece.released_at) return { ok: false, reason: "A peça precisa estar liberada." };
  if (!piece.cem_registered || !piece.cem_checked) {
    return { ok: false, reason: "Cadastro e conferência no CEM são obrigatórios." };
  }
  if (activeProdBatchId) {
    return { ok: false, reason: "A peça já está vinculada a um PROD ativo." };
  }
  const hasBlockingCorrection = corrections.some(
    (correction) =>
      correction.blocking && !["encerrada", "cancelada"].includes(correction.status),
  );
  if (hasBlockingCorrection) return { ok: false, reason: "Correção bloqueante aberta impede o PROD." };
  if (piece.status === "cancelada") return { ok: false, reason: "Peça cancelada não pode entrar no PROD." };
  return { ok: true, reason: null };
}

export function canApproveProd({
  prod,
  isManager,
}: {
  prod: Pick<TechnicalProdBatch, "status" | "cem_registered" | "cem_checked">;
  isManager: boolean;
}) {
  if (!isManager) return { ok: false, reason: "Somente Gestor Técnico ou Administrador aprova PROD." };
  if (!prod.cem_registered || !prod.cem_checked) {
    return { ok: false, reason: "PROD não avança sem cadastro e conferência no CEM." };
  }
  if (prod.status !== "aguardando_aprovacao") {
    return { ok: false, reason: "Somente PROD aguardando aprovação pode ser aprovado." };
  }
  return { ok: true, reason: null };
}

export function canConfirmDepartmentDelivery({
  department,
  deliveryType,
}: {
  department: DepartmentKey;
  deliveryType: "lista_materiais" | "ordem_producao";
}) {
  if (department === "suprimentos" && deliveryType !== "lista_materiais") {
    return { ok: false, reason: "Suprimentos confirma somente listas de materiais." };
  }
  if (department === "producao" && deliveryType !== "ordem_producao") {
    return { ok: false, reason: "Produção confirma somente ordens de produção." };
  }
  return { ok: true, reason: null };
}

export function visitRequiresReport(visit: Pick<TechnicalVisit, "status" | "report_generated_at">) {
  return visit.status === "realizada" && !visit.report_generated_at;
}

export function calculateReleaseProgress(pieces: Array<Pick<TechnicalPiece, "status" | "deleted_at">>) {
  const activePieces = pieces.filter((piece) => !piece.deleted_at && piece.status !== "cancelada");
  const total = activePieces.length;
  const released = activePieces.filter((piece) =>
    ["liberada", "em_prod", "entregue"].includes(piece.status),
  ).length;

  return {
    total,
    released,
    balance: total - released,
    percent: total ? Math.round((released / total) * 100) : 0,
  };
}

export function isOverdue(date: string | null | undefined, now = new Date()) {
  if (!date) return false;
  const target = new Date(`${date}T23:59:59`);
  return Number.isFinite(target.getTime()) && target.getTime() < now.getTime();
}
