import {
  priorityLabels,
  technicalActionStatusLabels,
  technicalContractStatusLabels,
  technicalCorrectionStatusLabels,
  technicalPieceStatusLabels,
  technicalProdStatusLabels,
  technicalVisitStatusLabels,
} from "@/lib/labels";
import type {
  Priority,
  TechnicalActionStatus,
  TechnicalContractStatus,
  TechnicalCorrectionStatus,
  TechnicalPieceStatus,
  TechnicalProdStatus,
  TechnicalVisitStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const statusTone: Record<string, string> = {
  aguardando_pasta: "bg-amber-50 text-amber-800 ring-amber-200",
  aguardando_reuniao: "bg-amber-50 text-amber-800 ring-amber-200",
  em_acompanhamento: "bg-blue-50 text-blue-800 ring-blue-200",
  aguardando_visita: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  em_medicao: "bg-orange-50 text-orange-800 ring-orange-200",
  em_liberacao: "bg-orange-50 text-orange-800 ring-orange-200",
  em_prod: "bg-purple-50 text-purple-800 ring-purple-200",
  repassado: "bg-green-50 text-green-800 ring-green-200",
  concluido: "bg-green-50 text-green-800 ring-green-200",
  cancelado: "bg-zinc-200 text-zinc-700 ring-zinc-300",
  aberta: "bg-amber-50 text-amber-800 ring-amber-200",
  em_andamento: "bg-blue-50 text-blue-800 ring-blue-200",
  concluida: "bg-green-50 text-green-800 ring-green-200",
  validada: "bg-green-50 text-green-800 ring-green-200",
  agendada: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  realizada: "bg-blue-50 text-blue-800 ring-blue-200",
  aguardando_relatorio: "bg-orange-50 text-orange-800 ring-orange-200",
  relatorio_emitido: "bg-green-50 text-green-800 ring-green-200",
  aguardando_avaliacao: "bg-amber-50 text-amber-800 ring-amber-200",
  avaliada: "bg-blue-50 text-blue-800 ring-blue-200",
  medida: "bg-orange-50 text-orange-800 ring-orange-200",
  liberada: "bg-green-50 text-green-800 ring-green-200",
  em_correcao: "bg-red-50 text-red-800 ring-red-200",
  entregue: "bg-green-50 text-green-800 ring-green-200",
  aguardando_validacao: "bg-orange-50 text-orange-800 ring-orange-200",
  rascunho: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  aguardando_cem: "bg-amber-50 text-amber-800 ring-amber-200",
  aguardando_conferencia: "bg-orange-50 text-orange-800 ring-orange-200",
  aguardando_aprovacao: "bg-purple-50 text-purple-800 ring-purple-200",
  aprovado: "bg-green-50 text-green-800 ring-green-200",
  devolvido: "bg-red-50 text-red-800 ring-red-200",
  entregue_suprimentos: "bg-green-50 text-green-800 ring-green-200",
  entregue_producao: "bg-green-50 text-green-800 ring-green-200",
};

const priorityTone: Record<Priority, string> = {
  baixa: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  normal: "bg-blue-50 text-blue-800 ring-blue-200",
  alta: "bg-orange-50 text-orange-800 ring-orange-200",
  urgente: "bg-red-50 text-red-800 ring-red-200",
};

type BadgeType = "contract" | "action" | "visit" | "piece" | "correction" | "prod" | "plain";

export function StatusBadge({
  status,
  type = "plain",
}: {
  status:
    | TechnicalContractStatus
    | TechnicalActionStatus
    | TechnicalVisitStatus
    | TechnicalPieceStatus
    | TechnicalCorrectionStatus
    | TechnicalProdStatus
    | string;
  type?: BadgeType;
}) {
  const label =
    type === "contract"
      ? technicalContractStatusLabels[status as TechnicalContractStatus]
      : type === "action"
        ? technicalActionStatusLabels[status as TechnicalActionStatus]
        : type === "visit"
          ? technicalVisitStatusLabels[status as TechnicalVisitStatus]
          : type === "piece"
            ? technicalPieceStatusLabels[status as TechnicalPieceStatus]
            : type === "correction"
              ? technicalCorrectionStatusLabels[status as TechnicalCorrectionStatus]
              : type === "prod"
                ? technicalProdStatusLabels[status as TechnicalProdStatus]
                : status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1",
        statusTone[status] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200",
      )}
    >
      {label ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1",
        priorityTone[priority],
      )}
    >
      {priorityLabels[priority]}
    </span>
  );
}
