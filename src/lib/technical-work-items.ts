import { isOverdue } from "@/lib/technical-rules";
import type { TechnicalAction, TechnicalCorrection } from "@/lib/types";

type WorkItemFields = Pick<TechnicalAction,
  "id" | "contract_id" | "title" | "description" | "responsible_profile_id" | "due_date" | "priority" | "blocking"
> & {
  piece_id: string | null;
  prod_batch_id: string | null;
  action_type: TechnicalAction["action_type"] | null;
  financial_impact: TechnicalAction["financial_impact"] | null;
  financial_amount: number | null;
  critical: boolean;
  closed: boolean;
};

export type TechnicalWorkItem = WorkItemFields & (
  { kind: "action"; status: TechnicalAction["status"] } |
  { kind: "correction"; status: TechnicalCorrection["status"] }
);

export function buildTechnicalWorkItems(actions: TechnicalAction[], corrections: TechnicalCorrection[]): TechnicalWorkItem[] {
  return [
    ...actions.filter((item) => !item.deleted_at).map((item): TechnicalWorkItem => ({
      id: item.id, contract_id: item.contract_id, title: item.title, description: item.description,
      responsible_profile_id: item.responsible_profile_id, due_date: item.due_date,
      priority: item.priority, blocking: item.blocking, status: item.status,
      kind: "action", piece_id: item.piece_id ?? null, prod_batch_id: null,
      action_type: item.action_type ?? "geral", financial_impact: item.financial_impact ?? null,
      financial_amount: item.financial_amount ?? null, critical: false,
      closed: ["concluida", "cancelada"].includes(item.status),
    })),
    ...corrections.filter((item) => !item.deleted_at).map((item): TechnicalWorkItem => ({
      id: item.id, contract_id: item.contract_id, title: item.type, description: item.description,
      responsible_profile_id: item.responsible_profile_id, due_date: item.due_date,
      priority: item.priority, blocking: item.blocking, status: item.status,
      kind: "correction", piece_id: item.piece_id, prod_batch_id: item.prod_batch_id,
      action_type: null, financial_impact: null, financial_amount: null, critical: item.critical,
      closed: ["encerrada", "cancelada"].includes(item.status),
    })),
  ];
}

export type WorkItemFilters = {
  kind?: "all" | "action" | "correction";
  situation?: "all" | "open" | "closed";
  contractId?: string;
  attention?: "all" | "overdue" | "blocking" | "critical";
};

export function filterTechnicalWorkItems(items: TechnicalWorkItem[], filters: WorkItemFilters) {
  const priorities = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
  return items.filter((item) => {
    if (filters.kind && filters.kind !== "all" && item.kind !== filters.kind) return false;
    if (filters.contractId && item.contract_id !== filters.contractId) return false;
    if (filters.situation === "open" && item.closed) return false;
    if (filters.situation === "closed" && !item.closed) return false;
    if (filters.attention === "overdue" && (item.closed || !isOverdue(item.due_date))) return false;
    if (filters.attention === "blocking" && (item.closed || !item.blocking)) return false;
    if (filters.attention === "critical" && (item.closed || !item.critical)) return false;
    return true;
  }).sort((left, right) =>
    Number(left.closed) - Number(right.closed) ||
    Number(right.critical) - Number(left.critical) ||
    Number(right.blocking) - Number(left.blocking) ||
    Number(isOverdue(right.due_date)) - Number(isOverdue(left.due_date)) ||
    String(left.due_date ?? "9999-12-31").localeCompare(String(right.due_date ?? "9999-12-31")) ||
    priorities[left.priority] - priorities[right.priority] ||
    left.id.localeCompare(right.id),
  );
}
