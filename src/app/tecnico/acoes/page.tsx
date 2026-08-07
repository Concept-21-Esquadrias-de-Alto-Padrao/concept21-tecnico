import Link from "next/link";
import { redirect } from "next/navigation";
import { createTechnicalActionAction, transitionTechnicalActionFormAction } from "@/app/actions";
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
import { isOverdue } from "@/lib/technical-rules";
import { formatDate } from "@/lib/utils";

export default async function TechnicalActionsPage() {
  const access = await getCurrentPermissionFlags([...appNavigationPermissionKeys, ...TECHNICAL_PERMISSIONS]);
  if (!canAccessModule(access, MODULE_ACCESS.actions)) redirect(firstAllowedAppRoute(access) ?? "/login");
  const snapshot = await getTechnicalOperationalData();
  const canManage = access.isMaster || access.permissions["technical.actions.manage"];
  const openActions = snapshot.actions
    .filter((action) => !action.deleted_at && !["concluida", "validada", "cancelada"].includes(action.status))
    .sort(
      (left, right) =>
        Number(right.blocking) - Number(left.blocking) ||
        Number(isOverdue(right.due_date)) - Number(isOverdue(left.due_date)) ||
        String(left.due_date ?? "9999-12-31").localeCompare(String(right.due_date ?? "9999-12-31")),
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Ações Técnicas" description="Pendências da reunião de fechamento e acompanhamento técnico-operacional." />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader title="Ações abertas" description="Todas as ações pendentes, com indicação de vencimento e bloqueio." />
          <PanelBody className="space-y-3">
            {openActions.map((action) => {
              const contract = snapshot.contracts.find((item) => item.id === action.contract_id);
              const overdue = isOverdue(action.due_date);
              return (
                <article key={action.id} className="rounded-md border border-border bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/tecnico/contratos/${action.contract_id}`} className="font-semibold text-charcoal hover:text-accent">
                        {action.title}
                      </Link>
                      <p className="mt-1 text-muted-foreground">{contract?.contract_number ?? "Contrato"} · Prazo: {formatDate(action.due_date)}</p>
                      {overdue ? (
                        <p className="mt-1 font-semibold text-danger">Vencida</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {action.blocking ? (
                        <span className="inline-flex rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200">
                          Bloqueante
                        </span>
                      ) : null}
                      <PriorityBadge priority={action.priority} />
                      <StatusBadge status={action.status} type="action" />
                    </div>
                  </div>
                  {canManage ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["em_andamento", "concluida", "validada"].map((status) => (
                        <form key={status} action={transitionTechnicalActionFormAction}>
                          <input type="hidden" name="id" value={action.id} />
                          <input type="hidden" name="next_status" value={status} />
                          <button className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">{status.replaceAll("_", " ")}</button>
                        </form>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!openActions.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma ação aberta no momento.</p>
            ) : null}
          </PanelBody>
        </Panel>
        {canManage ? (
          <Panel>
            <PanelHeader title="Nova ação" />
            <PanelBody>
              <ActionForm action={createTechnicalActionAction} submitLabel="Criar ação">
                <Field label="Contrato">
                  <select name="contract_id" className={inputClass} required>
                    <option value="">Selecione</option>
                    {snapshot.contracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>{contract.contract_number} · {contract.work_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Título"><input name="title" className={inputClass} required /></Field>
                <Field label="Descrição"><textarea name="description" className={textareaClass} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Responsável">
                    <select name="responsible_profile_id" className={inputClass}>
                      <option value="">A definir</option>
                      {snapshot.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Prazo"><input name="due_date" type="date" className={inputClass} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-charcoal"><input name="blocking" type="checkbox" /> Bloqueante</label>
              </ActionForm>
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
