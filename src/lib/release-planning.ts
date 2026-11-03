import { addDeadlineDays, type CalendarHoliday } from "./technical-rules";
import type { TechnicalPiece } from "./types";

export function releasePlan(pieces: TechnicalPiece[], today: string, holidays?: CalendarHoliday[]) {
  const active = pieces.filter(p => !p.deleted_at && p.status !== "cancelada");
  const isReleased = (p: TechnicalPiece) => Boolean(p.active_prod_batch_id) || ["liberada","em_prod","entregue"].includes(p.status);
  const releasedGroups = new Set(active.filter(isReleased).map(p => p.forecast_group).filter(Boolean));
  return active.map(piece => {
    const emitted = Boolean(piece.active_prod_batch_id) || ["em_prod","entregue"].includes(piece.status);
    const released = isReleased(piece);
    const replan = !released && !!piece.forecast_date && (piece.forecast_date < today || releasedGroups.has(piece.forecast_group));
    const basis = released ? piece.released_at?.slice(0,10) : replan ? null : piece.forecast_date;
    return {piece, units: piece.quantity ?? 1, released, emitted, replan,
      prodDue: basis && holidays ? addDeadlineDays({startDate:basis, days:5, unit:"dias_uteis", holidays}) : null};
  });
}
