"use client";

import { useCallback, useState } from "react";
import { createProdBatchAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";

type ContractOption = { id: string; number: string; client: string; work: string };
type PieceOption = { id: string; contractId: string; code: string; environment: string; model: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export function ProdCreationForm({ contracts, pieces }: { contracts: ContractOption[]; pieces: PieceOption[] }) {
  const [query, setQuery] = useState("");
  const [contractId, setContractId] = useState("");
  const resetSelection = useCallback(() => { setContractId(""); setQuery(""); }, []);
  const matching = contracts.filter((contract) => normalize(`${contract.number} ${contract.client} ${contract.work}`).includes(normalize(query)));
  const selected = contracts.find((contract) => contract.id === contractId);
  const options = selected && !matching.some((contract) => contract.id === contractId) ? [selected, ...matching] : matching;
  const available = pieces.filter((piece) => piece.contractId === contractId);
  return (
    <ActionForm action={createProdBatchAction} submitLabel="Montar PROD" onSuccess={resetSelection}>
      <Field label="Buscar contrato">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} placeholder="Digite o número, cliente ou nome da obra" />
      </Field>
      <Field label="Contrato / cliente">
        <select name="contract_id" value={contractId} onChange={(event) => setContractId(event.target.value)} className={inputClass} required>
          <option value="">Selecione a obra</option>
          {options.map((contract) => <option key={contract.id} value={contract.id}>{contract.number} · {contract.client}{contract.work && contract.work !== contract.client ? ` · ${contract.work}` : ""}</option>)}
        </select>
      </Field>
      {!matching.length ? <p role="status" className="text-sm text-muted-foreground">Nenhum contrato encontrado para esta busca.{selected ? " A obra selecionada foi mantida." : ""}</p> : null}
      {selected ? <p className="rounded-md bg-muted p-3 text-sm"><strong>{selected.number} · {selected.client}</strong>{selected.work && selected.work !== selected.client ? <span className="block">{selected.work}</span> : null}</p> : null}
      <Field label="Número do PROD"><input name="batch_number" className={inputClass} required /></Field>
      <Field label="Descrição"><textarea name="description" className={textareaClass} /></Field>
      <fieldset key={contractId} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Peças liberadas e conferidas{contractId ? ` (${available.length})` : ""}</legend>
        {!contractId ? <p className="text-sm text-muted-foreground">Selecione uma obra para ver suas peças.</p> : !available.length ? <p className="text-sm text-muted-foreground">Esta obra não tem peças liberadas e conferidas disponíveis para uma nova PROD.</p> : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {available.map((piece) => <label key={piece.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted">
              <input type="checkbox" name="piece_ids" value={piece.id} className="mt-1 accent-accent" />
              <span className="min-w-0 text-sm"><strong>{piece.code} · {piece.environment}</strong><span className="block break-words text-muted-foreground">{piece.model}</span></span>
            </label>)}
          </div>
        )}
      </fieldset>
    </ActionForm>
  );
}
