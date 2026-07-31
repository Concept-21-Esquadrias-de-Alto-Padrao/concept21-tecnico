"use client";

import { AlertTriangle, FileSearch, Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { confirmContractImportAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import type { ParsedTechnicalContract, ParsedTechnicalPiece } from "@/lib/technical-pdf";

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
        {message ? <p className="mt-3 text-sm font-medium text-danger">{message}</p> : null}
      </div>

      {preview ? (
        <div className="space-y-4 rounded-md border border-border bg-white p-4">
          <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-charcoal">{preview.fileName}</p>
              <p className="text-xs text-muted-foreground">
                Revise os dados antes de gravar. Nada é salvo automaticamente.
              </p>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              {preview.pieces.length} peça(s)
            </span>
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

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-charcoal">Peças extraídas</h3>
              <button
                type="button"
                onClick={addPiece}
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-charcoal hover:bg-muted"
              >
                <Plus className="size-4" />
                Adicionar peça
              </button>
            </div>
            <div className="space-y-3 md:hidden">
              {preview.pieces.map((piece, index) => (
                <article key={`${piece.code}-${index}-mobile`} className="rounded-md border border-border bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-charcoal">Peça {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removePiece(index)}
                      className="grid size-10 place-items-center rounded-md border border-border text-danger hover:bg-red-50"
                      title="Remover peça"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Código">
                      <input
                        className={inputClass}
                        value={piece.code}
                        onChange={(event) => updatePiece(index, { code: event.target.value })}
                      />
                    </Field>
                    <Field label="Tipo">
                      <input
                        className={inputClass}
                        value={piece.piece_type ?? ""}
                        onChange={(event) => updatePiece(index, { piece_type: event.target.value })}
                      />
                    </Field>
                    <Field label="Quantidade">
                      <input
                        type="number"
                        min={1}
                        className={inputClass}
                        value={piece.quantity}
                        onChange={(event) => updatePiece(index, { quantity: Number(event.target.value) || 1 })}
                      />
                    </Field>
                    <Field label="Largura">
                      <input
                        type="number"
                        className={inputClass}
                        value={piece.sale_width_mm ?? ""}
                        onChange={(event) => updatePiece(index, { sale_width_mm: event.target.value ? Number(event.target.value) : null })}
                      />
                    </Field>
                    <Field label="Altura">
                      <input
                        type="number"
                        className={inputClass}
                        value={piece.sale_height_mm ?? ""}
                        onChange={(event) => updatePiece(index, { sale_height_mm: event.target.value ? Number(event.target.value) : null })}
                      />
                    </Field>
                    <Field label="Ambiente">
                      <input
                        className={inputClass}
                        value={piece.environment ?? ""}
                        onChange={(event) => updatePiece(index, { environment: event.target.value })}
                      />
                    </Field>
                    <Field label="Vidro">
                      <input
                        className={inputClass}
                        value={piece.glass ?? ""}
                        onChange={(event) => updatePiece(index, { glass: event.target.value })}
                      />
                    </Field>
                    <Field label="Cor">
                      <input
                        className={inputClass}
                        value={piece.color ?? ""}
                        onChange={(event) => updatePiece(index, { color: event.target.value })}
                      />
                    </Field>
                    <Field label="Linha">
                      <input
                        className={inputClass}
                        value={piece.line ?? ""}
                        onChange={(event) => updatePiece(index, { line: event.target.value })}
                      />
                    </Field>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[900px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="border-b border-border py-2 pr-2">Código</th>
                    <th className="border-b border-border px-2 py-2">Tipo</th>
                    <th className="border-b border-border px-2 py-2">Qtd</th>
                    <th className="border-b border-border px-2 py-2">Largura</th>
                    <th className="border-b border-border px-2 py-2">Altura</th>
                    <th className="border-b border-border px-2 py-2">Ambiente</th>
                    <th className="border-b border-border px-2 py-2">Vidro</th>
                    <th className="border-b border-border px-2 py-2">Cor</th>
                    <th className="border-b border-border px-2 py-2">Linha</th>
                    <th className="border-b border-border py-2 pl-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.pieces.map((piece, index) => (
                    <tr key={`${piece.code}-${index}`}>
                      <td className="border-b border-border py-2 pr-2">
                        <input
                          className={inputClass}
                          value={piece.code}
                          onChange={(event) => updatePiece(index, { code: event.target.value })}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2">
                        <input
                          className={inputClass}
                          value={piece.piece_type ?? ""}
                          onChange={(event) => updatePiece(index, { piece_type: event.target.value })}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          value={piece.quantity}
                          onChange={(event) => updatePiece(index, { quantity: Number(event.target.value) || 1 })}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2">
                        <input
                          type="number"
                          className={inputClass}
                          value={piece.sale_width_mm ?? ""}
                          onChange={(event) => updatePiece(index, { sale_width_mm: event.target.value ? Number(event.target.value) : null })}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2">
                        <input
                          type="number"
                          className={inputClass}
                          value={piece.sale_height_mm ?? ""}
                          onChange={(event) => updatePiece(index, { sale_height_mm: event.target.value ? Number(event.target.value) : null })}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2">
                        <input
                          className={inputClass}
                          value={piece.environment ?? ""}
                          onChange={(event) => updatePiece(index, { environment: event.target.value })}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2">
                        <input
                          className={inputClass}
                          value={piece.glass ?? ""}
                          onChange={(event) => updatePiece(index, { glass: event.target.value })}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2">
                        <input
                          className={inputClass}
                          value={piece.color ?? ""}
                          onChange={(event) => updatePiece(index, { color: event.target.value })}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2">
                        <input
                          className={inputClass}
                          value={piece.line ?? ""}
                          onChange={(event) => updatePiece(index, { line: event.target.value })}
                        />
                      </td>
                      <td className="border-b border-border py-2 pl-2">
                        <button
                          type="button"
                          onClick={() => removePiece(index)}
                          className="grid size-10 place-items-center rounded-md border border-border text-danger hover:bg-red-50"
                          title="Remover peça"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ActionForm action={confirmContractImportAction} submitLabel="Confirmar e gravar contrato">
            <input type="hidden" name="contract_json" value={hiddenPayloads?.contract ?? ""} />
            <input type="hidden" name="pieces_json" value={hiddenPayloads?.pieces ?? "[]"} />
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
