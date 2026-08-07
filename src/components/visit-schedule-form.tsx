"use client";

import { useMemo, useState } from "react";
import { createVisitAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { StatusBadge } from "@/components/status-badge";
import type { ProductionContract, TechnicalPiece } from "@/lib/types";
import { cn } from "@/lib/utils";

type VisitScheduleFormProps = {
  contracts: Array<Pick<ProductionContract, "id" | "contract_number" | "work_name">>;
  pieces: Array<
    Pick<
      TechnicalPiece,
      | "id"
      | "contract_id"
      | "code"
      | "environment"
      | "piece_type"
      | "sale_width_mm"
      | "sale_height_mm"
      | "status"
      | "deleted_at"
    >
  >;
};

function pieceDimensions(piece: Pick<TechnicalPiece, "sale_width_mm" | "sale_height_mm">) {
  if (!piece.sale_width_mm && !piece.sale_height_mm) return "Medida de venda pendente";
  return `${piece.sale_width_mm ?? "-"} x ${piece.sale_height_mm ?? "-"} mm`;
}

export function VisitScheduleForm({ contracts, pieces }: VisitScheduleFormProps) {
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);

  const contractPieces = useMemo(
    () =>
      pieces
        .filter((piece) => piece.contract_id === selectedContractId && !piece.deleted_at)
        .sort((left, right) =>
          left.code.localeCompare(right.code, "pt-BR", { numeric: true, sensitivity: "base" }),
        ),
    [pieces, selectedContractId],
  );

  function togglePiece(pieceId: string, checked: boolean) {
    setSelectedPieceIds((current) =>
      checked ? Array.from(new Set([...current, pieceId])) : current.filter((id) => id !== pieceId),
    );
  }

  return (
    <ActionForm action={createVisitAction} submitLabel="Agendar visita">
      <Field label="Contrato">
        <select
          name="contract_id"
          className={inputClass}
          required
          value={selectedContractId}
          onChange={(event) => {
            setSelectedContractId(event.target.value);
            setSelectedPieceIds([]);
          }}
        >
          <option value="">Selecione</option>
          {contracts.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.contract_number} - {contract.work_name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <input name="visit_type" className={inputClass} defaultValue="Medição" required />
        </Field>
        <Field label="Data">
          <input name="scheduled_date" type="date" className={inputClass} required />
        </Field>
        <Field label="Horário">
          <input name="scheduled_time" type="time" className={inputClass} />
        </Field>
        <Field label="Técnicos">
          <input name="technicians" className={inputClass} required />
        </Field>
      </div>

      <Field label="Objetivos">
        <textarea name="objectives" className={textareaClass} required />
      </Field>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-charcoal">Peças do contrato</p>
          {selectedContractId ? (
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              {selectedPieceIds.length} selecionada(s)
            </span>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-white p-2">
          {!selectedContractId ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum contrato selecionado.</p>
          ) : contractPieces.length ? (
            <div className="grid gap-2">
              {contractPieces.map((piece) => {
                const checked = selectedPieceIds.includes(piece.id);
                return (
                  <label
                    key={piece.id}
                    className={cn(
                      "grid cursor-pointer gap-3 rounded-md border px-3 py-3 transition sm:grid-cols-[auto_1fr_auto] sm:items-start",
                      checked
                        ? "border-accent bg-orange-50"
                        : "border-border bg-white hover:border-accent/60 hover:bg-muted/40",
                    )}
                  >
                    <input
                      name="piece_ids"
                      type="checkbox"
                      value={piece.id}
                      checked={checked}
                      onChange={(event) => togglePiece(piece.id, event.target.checked)}
                      className="mt-1 size-4 accent-orange-600"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-charcoal">{piece.code}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {piece.environment ?? "Sem ambiente"} · {piece.piece_type ?? "Sem tipo"}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Venda: {pieceDimensions(piece)}
                      </span>
                    </span>
                    <span className="sm:justify-self-end">
                      <StatusBadge status={piece.status} type="piece" />
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nenhuma peça ativa vinculada a este contrato.
            </p>
          )}
        </div>
      </div>
    </ActionForm>
  );
}
