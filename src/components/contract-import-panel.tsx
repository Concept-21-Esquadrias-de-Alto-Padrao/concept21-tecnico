"use client";

import {
  AlertTriangle,
  Box,
  FileSearch,
  Layers,
  Loader2,
  MapPin,
  Palette,
  Plus,
  Ruler,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { confirmContractImportAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import type { ParsedTechnicalContract, ParsedTechnicalPiece } from "@/lib/technical-pdf";
import { cn } from "@/lib/utils";

type PreviewPayload = {
  fileName: string;
  contract: ParsedTechnicalContract;
  pieces: ParsedTechnicalPiece[];
  duplicateContract: boolean;
  duplicatePieceCodes: string[];
  warnings: string[];
};

function emptyPiece(index: number): ParsedTechnicalPiece {
  return {
    code: `P${String(index + 1).padStart(2, "0")}`,
    piece_type: null,
    quantity: 1,
    sale_width_mm: null,
    sale_height_mm: null,
    environment: null,
    description: null,
    glass: null,
    color: null,
    line: null,
  };
}

function numberOrNull(value: string) {
  return value ? Number(value) : null;
}

function pieceQuantityTotal(pieces: ParsedTechnicalPiece[]) {
  return pieces.reduce((total, piece) => total + (Number.isFinite(piece.quantity) ? piece.quantity : 0), 0);
}

function pieceArea(piece: ParsedTechnicalPiece) {
  if (!piece.sale_width_mm || !piece.sale_height_mm) return null;
  return (piece.sale_width_mm * piece.sale_height_mm * piece.quantity) / 1_000_000;
}

function formatArea(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function PieceMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ruler;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <Icon className="size-4 flex-none text-accent" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-charcoal" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function PieceInput({
  label,
  value,
  onChange,
  className,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  type?: "text" | "number";
}) {
  return (
    <Field label={label} className={className}>
      <input
        type={type}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function PieceCard({
  index,
  onRemove,
  onUpdate,
  piece,
}: {
  index: number;
  onRemove: () => void;
  onUpdate: (patch: Partial<ParsedTechnicalPiece>) => void;
  piece: ParsedTechnicalPiece;
}) {
  const dimensions =
    piece.sale_width_mm && piece.sale_height_mm
      ? `${piece.sale_width_mm} x ${piece.sale_height_mm} mm`
      : "Sem medida";
  const area = pieceArea(piece);

  return (
    <article className="rounded-md border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-charcoal px-2.5 py-1 text-sm font-semibold text-white">
              {piece.code || `Peça ${index + 1}`}
            </span>
            <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Qtd {piece.quantity || 1}
            </span>
            {piece.line ? (
              <span className="rounded-md bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200">
                {piece.line}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-semibold text-charcoal">
            {piece.piece_type || "Tipo não informado"}
          </p>
          {piece.environment ? (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <MapPin className="size-3.5 text-accent" />
              {piece.environment}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 lg:flex-none"
          title="Remover peça"
        >
          <Trash2 className="size-4" />
          Remover
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <PieceMetric icon={Ruler} label="Medida" value={dimensions} />
        <PieceMetric icon={Box} label="Área estimada" value={`${formatArea(area)} m²`} />
        <PieceMetric icon={Layers} label="Vidro" value={piece.glass || "Não informado"} />
        <PieceMetric icon={Palette} label="Cor" value={piece.color || "Não informada"} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-12">
        <PieceInput
          label="Código"
          value={piece.code}
          className="lg:col-span-2"
          onChange={(value) => onUpdate({ code: value })}
        />
        <PieceInput
          label="Quantidade"
          type="number"
          value={piece.quantity}
          className="lg:col-span-2"
          onChange={(value) => onUpdate({ quantity: Number(value) || 1 })}
        />
        <PieceInput
          label="Largura"
          type="number"
          value={piece.sale_width_mm ?? ""}
          className="lg:col-span-2"
          onChange={(value) => onUpdate({ sale_width_mm: numberOrNull(value) })}
        />
        <PieceInput
          label="Altura"
          type="number"
          value={piece.sale_height_mm ?? ""}
          className="lg:col-span-2"
          onChange={(value) => onUpdate({ sale_height_mm: numberOrNull(value) })}
        />
        <PieceInput
          label="Linha"
          value={piece.line ?? ""}
          className="lg:col-span-2"
          onChange={(value) => onUpdate({ line: value })}
        />
        <PieceInput
          label="Ambiente"
          value={piece.environment ?? ""}
          className="lg:col-span-2"
          onChange={(value) => onUpdate({ environment: value })}
        />
        <Field label="Tipo" className="lg:col-span-6">
          <textarea
            className={cn(textareaClass, "min-h-20")}
            value={piece.piece_type ?? ""}
            onChange={(event) =>
              onUpdate({
                piece_type: event.target.value,
                description: event.target.value,
              })
            }
          />
        </Field>
        <Field label="Vidro" className="lg:col-span-3">
          <textarea
            className={cn(textareaClass, "min-h-20")}
            value={piece.glass ?? ""}
            onChange={(event) => onUpdate({ glass: event.target.value })}
          />
        </Field>
        <Field label="Cor/acabamento" className="lg:col-span-3">
          <textarea
            className={cn(textareaClass, "min-h-20")}
            value={piece.color ?? ""}
            onChange={(event) => onUpdate({ color: event.target.value })}
          />
        </Field>
      </div>
    </article>
  );
}

export function ContractImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handlePreview() {
    setMessage("");
    setPreview(null);

    if (!file) {
      setMessage("Selecione um PDF para importar.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);

    try {
      const response = await fetch("/api/technical/contracts/preview", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao ler PDF.");
      }

      setPreview(payload as PreviewPayload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao ler PDF.");
    } finally {
      setLoading(false);
    }
  }

  function updateContract<K extends keyof ParsedTechnicalContract>(
    key: K,
    value: ParsedTechnicalContract[K],
  ) {
    setPreview((current) =>
      current
        ? {
            ...current,
            contract: { ...current.contract, [key]: value },
          }
        : current,
    );
  }

  function updatePiece(index: number, patch: Partial<ParsedTechnicalPiece>) {
    setPreview((current) =>
      current
        ? {
            ...current,
            pieces: current.pieces.map((piece, pieceIndex) =>
              pieceIndex === index ? { ...piece, ...patch } : piece,
            ),
          }
        : current,
    );
  }

  function removePiece(index: number) {
    setPreview((current) =>
      current
        ? {
            ...current,
            pieces: current.pieces.filter((_, pieceIndex) => pieceIndex !== index),
          }
        : current,
    );
  }

  function addPiece() {
    setPreview((current) =>
      current
        ? {
            ...current,
            pieces: [...current.pieces, emptyPiece(current.pieces.length)],
          }
        : current,
    );
  }

  const hiddenPayloads = useMemo(
    () =>
      preview
        ? {
            contract: JSON.stringify(preview.contract),
            pieces: JSON.stringify(preview.pieces),
          }
        : null,
    [preview],
  );
  const quantityTotal = preview ? pieceQuantityTotal(preview.pieces) : 0;
  const areaTotal = preview
    ? preview.pieces.reduce((total, piece) => total + (pieceArea(piece) ?? 0), 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-charcoal">PDF do contrato</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
            Conferir extração
          </button>
        </div>
        {message ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {message}
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="space-y-5 rounded-md border border-border bg-white p-4">
          <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-charcoal">{preview.fileName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Revise os dados antes de gravar. Nada é salvo automaticamente.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:flex sm:text-left">
              <span className="rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                {preview.pieces.length} item(ns)
              </span>
              <span className="rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                {quantityTotal} peça(s)
              </span>
              <span className="rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                {formatArea(areaTotal)} m²
              </span>
            </div>
          </div>

          {preview.warnings.length ? (
            <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 flex-none" />
                <div className="space-y-1">
                  {preview.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-charcoal">Dados do contrato</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Número do contrato">
                <input
                  className={inputClass}
                  value={preview.contract.contract_number ?? ""}
                  onChange={(event) => updateContract("contract_number", event.target.value)}
                />
              </Field>
              <Field label="Cliente">
                <input
                  className={inputClass}
                  value={preview.contract.client_name ?? ""}
                  onChange={(event) => updateContract("client_name", event.target.value)}
                />
              </Field>
              <Field label="Data do contrato">
                <input
                  type="date"
                  className={inputClass}
                  value={preview.contract.contract_date ?? ""}
                  onChange={(event) => updateContract("contract_date", event.target.value)}
                />
              </Field>
              <Field label="Prazo contratual">
                <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                  <input
                    type="number"
                    className={inputClass}
                    value={preview.contract.deadline_value ?? ""}
                    onChange={(event) =>
                      updateContract(
                        "deadline_value",
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                  />
                  <select
                    className={inputClass}
                    value={preview.contract.deadline_unit}
                    onChange={(event) =>
                      updateContract(
                        "deadline_unit",
                        event.target.value as ParsedTechnicalContract["deadline_unit"],
                      )
                    }
                  >
                    <option value="dias_uteis">Dias úteis</option>
                    <option value="dias_corridos">Dias corridos</option>
                  </select>
                </div>
              </Field>
              <Field label="Obra">
                <input
                  className={inputClass}
                  value={preview.contract.work_name ?? ""}
                  onChange={(event) => updateContract("work_name", event.target.value)}
                />
              </Field>
              <Field label="Endereço da obra">
                <input
                  className={inputClass}
                  value={preview.contract.work_address ?? ""}
                  onChange={(event) => updateContract("work_address", event.target.value)}
                />
              </Field>
              <Field label="Descrição" className="md:col-span-2">
                <textarea
                  className={textareaClass}
                  value={preview.contract.description ?? ""}
                  onChange={(event) => updateContract("description", event.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <div>
                <h3 className="text-sm font-semibold text-charcoal">Peças extraídas</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.pieces.length} item(ns), {quantityTotal} peça(s), {formatArea(areaTotal)} m²
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {preview.pieces.map((piece, index) => (
                <PieceCard
                  key={`${piece.code}-${index}`}
                  index={index}
                  piece={piece}
                  onRemove={() => removePiece(index)}
                  onUpdate={(patch) => updatePiece(index, patch)}
                />
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={addPiece}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-charcoal hover:bg-muted sm:w-auto"
              >
                <Plus className="size-4" />
                Adicionar peça
              </button>
            </div>
          </section>

          <ActionForm action={confirmContractImportAction} submitLabel="Confirmar e gravar contrato">
            <input type="hidden" name="contract_json" value={hiddenPayloads?.contract ?? ""} />
            <input type="hidden" name="pieces_json" value={hiddenPayloads?.pieces ?? "[]"} />
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
