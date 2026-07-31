import Link from "next/link";
import { redirect } from "next/navigation";
import { closeCorrectionFormAction, createCorrectionAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalOperationalData } from "@/lib/technical-data";
import { formatDate } from "@/lib/utils";

export default async function TechnicalCorrectionsPage() {
  const access = await getCurrentPermissionFlags([...appNavigationPermissionKeys, ...TECHNICAL_PERMISSIONS]);
  if (!canAccessModule(access, MODULE_ACCESS.corrections)) redirect(firstAllowedAppRoute(access) ?? "/login");
  const snapshot = await getTechnicalOperationalData();
  const canManage = access.isMaster || access.permissions["technical.corrections.manage"];

  return (
    <div className="space-y-6">
      <PageHeader title="Correções Técnicas" description="Correções bloqueantes, críticas, prazos e responsáveis definidos pelo Gestor." />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader title="Correções" />
          <PanelBody className="space-y-3">
            {snapshot.corrections.map((correction) => {
              const contract = snapshot.contracts.find((item) => item.id === correction.contract_id);
              return (
                <article key={correction.id} className="rounded-md border border-border bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/tecnico/contratos/${correction.contract_id}`} className="font-semibold text-charcoal hover:text-accent">{correction.type}</Link>
                      <p className="mt-1 text-muted-foreground">{contract?.contract_number ?? "Contrato"} · {correction.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Prazo: {formatDate(correction.due_date)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <PriorityBadge priority={correction.priority} />
                      <StatusBadge status={correction.status} type="correction" />
                      {correction.critical ? <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200">Crítica</span> : null}
                    </div>
                  </div>
                  {canManage && !["encerrada", "cancelada"].includes(correction.status) ? (
                    <form action={closeCorrectionFormAction} className="mt-3">
                      <input type="hidden" name="id" value={correction.id} />
                      <button className="rounded-md bg-charcoal px-3 py-2 text-xs font-semibold text-white hover:bg-black">Encerrar</button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </PanelBody>
        </Panel>
        {canManage ? (
          <Panel>
            <PanelHeader title="Nova correção" />
            <PanelBody>
              <ActionForm action={createCorrectionAction} submitLabel="Registrar correção">
                <Field label="Contrato">
                  <select name="contract_id" className={inputClass} required>
                    <option value="">Selecione</option>
                    {snapshot.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_number}</option>)}
                  </select>
                </Field>
                <Field label="Peça">
                  <select name="piece_id" className={inputClass}>
                    <option value="">Sem peça específica</option>
                    {snapshot.pieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.code}</option>)}
                  </select>
                </Field>
                <Field label="Tipo"><input name="type" className={inputClass} required /></Field>
                <Field label="Descrição"><textarea name="description" className={textareaClass} required /></Field>
                <Field label="Prazo"><input name="due_date" type="date" className={inputClass} /></Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-charcoal"><input name="blocking" type="checkbox" /> Bloqueante</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-charcoal"><input name="critical" type="checkbox" /> Crítica</label>
              </ActionForm>
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
