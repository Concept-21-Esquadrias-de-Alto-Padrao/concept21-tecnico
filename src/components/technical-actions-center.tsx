"use client";

import { ChevronDown, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { closeCorrectionAction, createCorrectionAction, createTechnicalActionAction, updateTechnicalActionAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { ActionTransitionButtons } from "@/components/action-transition-buttons";
import { ActivityDeepLink } from "@/components/activity-deep-link";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { filterTechnicalWorkItems, type TechnicalWorkItem, type WorkItemFilters } from "@/lib/technical-work-items";
import { isOverdue } from "@/lib/technical-rules";
import { cn, formatDate } from "@/lib/utils";

type Options = {
  contracts: { id: string; contract_number: string; work_name: string }[];
  profiles: { id: string; name: string }[];
  pieces: { id: string; contract_id: string; code: string; environment: string | null }[];
  prods: { id: string; contract_id: string; batch_number: string }[];
};

type Permissions = {
  canViewActions: boolean;
  canViewCorrections: boolean;
  canManageActions: boolean;
  canValidateActions: boolean;
  canManageCorrections: boolean;
};

type Props = Options & Permissions & {
  items: TechnicalWorkItem[];
  contractId?: string;
  initialKind?: WorkItemFilters["kind"];
};

function NewActionForm({ contracts, profiles, pieces, prods, contractId: fixedContractId, canManageActions, canManageCorrections }: Props) {
  const [kind, setKind] = useState<"action" | "correction">(canManageActions ? "action" : "correction");
  const [contractId, setContractId] = useState(fixedContractId ?? "");
  const correction = kind === "correction";
  const contractPieces = pieces.filter((piece) => piece.contract_id === contractId);
  const contractProds = prods.filter((prod) => prod.contract_id === contractId);

  return (
    <details className="group border-y border-border py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-charcoal [&::-webkit-details-marker]:hidden">
        <Plus className="size-4 text-accent" /> Nova ação
        <ChevronDown className="ml-auto size-4 transition group-open:rotate-180" />
      </summary>
      <div className="pt-4">
        <Field label="Tipo de ação" className="mb-4 max-w-sm">
          <select className={cn(inputClass, "w-full")} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            {canManageActions ? <option value="action">Ação geral</option> : null}
            {canManageCorrections ? <option value="correction">Correção técnica</option> : null}
          </select>
        </Field>
        <ActionForm key={kind} action={correction ? createCorrectionAction : createTechnicalActionAction} submitLabel="Registrar ação">
          {fixedContractId ? <input type="hidden" name="contract_id" value={fixedContractId} /> : (
            <Field label="Contrato">
              <select name="contract_id" className={cn(inputClass, "w-full")} value={contractId} onChange={(event) => setContractId(event.target.value)} required>
                <option value="">Selecione</option>
                {contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_number} · {contract.work_name}</option>)}
              </select>
            </Field>
          )}
          <Field label={correction ? "Título" : "Título curto"}><input name={correction ? "type" : "title"} className={cn(inputClass, "w-full")} required /></Field>
          <Field label="Descrição breve"><textarea name="description" maxLength={correction ? undefined : 240} className={cn(textareaClass, "w-full")} required /></Field>
          {correction ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Peça">
                <select key={`piece-${contractId}`} name="piece_id" className={cn(inputClass, "w-full")} defaultValue="" disabled={!contractId}>
                  <option value="">Sem peça específica</option>
                  {contractPieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.code} · {piece.environment ?? "Sem ambiente"}</option>)}
                </select>
              </Field>
              <Field label="PROD">
                <select key={`prod-${contractId}`} name="prod_batch_id" className={cn(inputClass, "w-full")} defaultValue="" disabled={!contractId}>
                  <option value="">Sem PROD específico</option>
                  {contractProds.map((prod) => <option key={prod.id} value={prod.id}>{prod.batch_number}</option>)}
                </select>
              </Field>
            </div>
          ) : null}
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <Field label="Responsável">
              <select name="responsible_profile_id" className={cn(inputClass, "w-full")} required={!correction}>
                <option value="">Selecione</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </Field>
            <Field label="Prazo"><input name="due_date" type="date" className={cn(inputClass, "w-full")} /></Field>
            <Field label="Prioridade">
              <select name="priority" defaultValue="normal" className={cn(inputClass, "w-full")}>
                <option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
              </select>
            </Field>
          </div>
          {correction ? <Field label="Impacto"><input name="impact" className={cn(inputClass, "w-full")} /></Field> : (
            <input type="hidden" name="blocking_stage" value="entrada_inicial" />
          )}
          <div className="flex flex-wrap gap-5 text-sm font-semibold">
            <label className="flex items-center gap-2"><input name="blocking" type="checkbox" className="size-4" /> Bloqueante</label>
            {correction ? <label className="flex items-center gap-2"><input name="critical" type="checkbox" className="size-4" /> Crítica</label> : null}
          </div>
        </ActionForm>
      </div>
    </details>
  );
}

function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

const financialImpactLabels = {
  a_avaliar: "Impacto a avaliar",
  sem_impacto: "Sem impacto financeiro",
  credito: "Possível crédito",
  cobranca_adicional: "Possível cobrança adicional",
} as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function TechnicalActionsCenter(props: Props) {
  const { items, contracts, profiles, pieces, prods, contractId, canViewActions, canViewCorrections, canManageActions, canValidateActions, canManageCorrections } = props;
  const [kind, setKind] = useState<WorkItemFilters["kind"]>(props.initialKind ?? "all");
  const [situation, setSituation] = useState<WorkItemFilters["situation"]>("open");
  const [attention, setAttention] = useState<WorkItemFilters["attention"]>("all");
  const [selectedContract, setSelectedContract] = useState(contractId ?? "");
  const [query, setQuery] = useState("");
  const contractsById = new Map(contracts.map((item) => [item.id, item]));
  const namesById = new Map(profiles.map((item) => [item.id, item.name]));
  const piecesById = new Map(pieces.map((item) => [item.id, item]));
  const prodsById = new Map(prods.map((item) => [item.id, item]));
  const visible = filterTechnicalWorkItems(items, { kind, situation, attention, contractId: selectedContract }).filter((item) => {
    const contract = contractsById.get(item.contract_id);
    const piece = piecesById.get(item.piece_id ?? "");
    const prod = prodsById.get(item.prod_batch_id ?? "");
    return searchable([item.title, item.description, contract?.contract_number, contract?.work_name, namesById.get(item.responsible_profile_id ?? ""), piece?.code, piece?.environment, prod?.batch_number, item.financial_impact ? financialImpactLabels[item.financial_impact] : ""].join(" ")).includes(searchable(query.trim()));
  });

  return (
    <div className="min-w-0 space-y-4">
      <ActivityDeepLink />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Buscar" className="sm:col-span-2">
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <input type="search" className={cn(inputClass, "w-full pl-9")} value={query} onChange={(event) => setQuery(event.target.value)} />
          </span>
        </Field>
        <Field label="Tipo">
          <select className={cn(inputClass, "w-full")} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="all">Todos os tipos</option>
            {canViewActions ? <option value="action">Ação geral</option> : null}
            {canViewCorrections ? <option value="correction">Correção técnica</option> : null}
          </select>
        </Field>
        <Field label="Situação">
          <select className={cn(inputClass, "w-full")} value={situation} onChange={(event) => setSituation(event.target.value as typeof situation)}>
            <option value="open">Abertas</option><option value="closed">Encerradas</option><option value="all">Todas</option>
          </select>
        </Field>
        {!contractId ? <Field label="Contrato" className="sm:col-span-2">
          <select className={cn(inputClass, "w-full")} value={selectedContract} onChange={(event) => setSelectedContract(event.target.value)}>
            <option value="">Todos os contratos</option>
            {contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_number} · {contract.work_name}</option>)}
          </select>
        </Field> : null}
        <Field label="Sinalização" className="sm:col-span-2">
          <select className={cn(inputClass, "w-full")} value={attention} onChange={(event) => setAttention(event.target.value as typeof attention)}>
            <option value="all">Todas</option><option value="overdue">Vencidas</option><option value="blocking">Bloqueantes</option><option value="critical">Críticas</option>
          </select>
        </Field>
      </div>
      {canManageActions || canManageCorrections ? <NewActionForm {...props} /> : null}
      <p className="text-sm text-muted-foreground" role="status">{visible.length} ação(ões)</p>
      <div className="divide-y divide-border">
        {visible.map((item) => {
          const contract = contractsById.get(item.contract_id);
          const piece = piecesById.get(item.piece_id ?? "");
          const prod = prodsById.get(item.prod_batch_id ?? "");
          const overdue = !item.closed && isOverdue(item.due_date);
          return (
            <article id={`atividade-${item.kind}-${item.id}`} key={`${item.kind}-${item.id}`} className="min-w-0 scroll-mt-40 space-y-3 py-4 text-sm">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64 break-words">
                  <Link href={`/tecnico/contratos/${item.contract_id}#acoes`} className="font-semibold text-charcoal hover:text-accent">{item.title}</Link>
                  {item.description ? <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-muted-foreground" title={item.description}>{item.description}</p> : (
                    item.kind === "action" ? <p className="mt-1 text-muted-foreground">Sem descrição informada.</p> : null
                  )}
                </div>
                <div className="flex max-w-full flex-wrap gap-2">
                  <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", item.kind === "correction" ? "bg-orange-50 text-orange-800" : "bg-blue-50 text-blue-800")}>
                    {item.kind === "correction"
                      ? "Correção técnica"
                      : item.action_type === "alteracao_estrutural"
                        ? "Alteração estrutural"
                        : "Ação geral"}
                  </span>
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} type={item.kind} />
                  {item.blocking ? <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">Bloqueante</span> : null}
                  {item.critical ? <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">Crítica</span> : null}
                  {overdue ? <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">Vencida</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
                {!contractId ? <span>Contrato: <span className="text-charcoal">{contract?.contract_number ?? "-"}</span></span> : null}
                <span>Responsável: <span className="text-charcoal">{namesById.get(item.responsible_profile_id ?? "") ?? "A definir"}</span></span>
                <span>Prazo: <span className={overdue ? "font-semibold text-danger" : "text-charcoal"}>{formatDate(item.due_date)}</span></span>
                {piece ? <span>Peça: <span className="text-charcoal">{piece.code} · {piece.environment}</span></span> : null}
                {prod ? <span>PROD: <span className="text-charcoal">{prod.batch_number}</span></span> : null}
                {item.kind === "action" && item.action_type === "alteracao_estrutural" && item.financial_impact ? (
                  <span>
                    Impacto: <span className="text-charcoal">
                      {financialImpactLabels[item.financial_impact]}
                      {item.financial_amount !== null ? ` · ${formatCurrency(item.financial_amount)}` : ""}
                    </span>
                  </span>
                ) : null}
              </div>
              {item.kind === "action" && canManageActions ? (
                <details className="group/edit rounded-md border border-border bg-muted/20">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-charcoal [&::-webkit-details-marker]:hidden">
                    <Pencil className="size-3.5 text-accent" /> Editar ação
                    <ChevronDown className="ml-auto size-3.5 transition group-open/edit:rotate-180" />
                  </summary>
                  <ActionForm action={updateTechnicalActionAction} submitLabel="Salvar ação" className="border-t border-border p-3">
                    <input type="hidden" name="id" value={item.id} />
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <Field label="Título curto"><input name="title" defaultValue={item.title} className={inputClass} required /></Field>
                      <Field label="Responsável">
                        <select name="responsible_profile_id" defaultValue={item.responsible_profile_id ?? ""} className={inputClass} required>
                          <option value="">Selecione</option>
                          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Descrição breve"><textarea name="description" defaultValue={item.description ?? ""} maxLength={240} className={textareaClass} required /></Field>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <Field label="Prazo"><input name="due_date" type="date" defaultValue={item.due_date ?? ""} className={inputClass} /></Field>
                      <Field label="Prioridade">
                        <select name="priority" defaultValue={item.priority} className={inputClass}>
                          <option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
                        </select>
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-semibold"><input name="blocking" type="checkbox" defaultChecked={item.blocking} className="size-4" /> Bloqueante</label>
                  </ActionForm>
                </details>
              ) : null}
              {item.kind === "action" ? <ActionTransitionButtons action={item} canManage={canManageActions} canValidate={canValidateActions} /> : (
                canManageCorrections && !item.closed ? <ActionForm action={closeCorrectionAction} submitLabel="Encerrar correção" confirmMessage="Confirma o encerramento desta correção técnica?">
                  <input type="hidden" name="id" value={item.id} />
                </ActionForm> : null
              )}
            </article>
          );
        })}
        {!visible.length ? <p className="py-6 text-sm text-muted-foreground">Nenhuma ação encontrada.</p> : null}
      </div>
    </div>
  );
}
