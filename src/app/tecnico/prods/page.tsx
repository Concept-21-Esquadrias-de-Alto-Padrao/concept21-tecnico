import Link from "next/link";
import { redirect } from "next/navigation";
import {
  approveProdBatchFormAction,
  checkProdBatchFormAction,
  confirmDepartmentDeliveryFormAction,
  createProdBatchAction,
  deliverDepartmentDocumentAction,
} from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalOperationalData } from "@/lib/technical-data";

export default async function TechnicalProdsPage() {
  const access = await getCurrentPermissionFlags([...appNavigationPermissionKeys, ...TECHNICAL_PERMISSIONS]);
  if (!canAccessModule(access, MODULE_ACCESS.prods)) redirect(firstAllowedAppRoute(access) ?? "/login");
  const snapshot = await getTechnicalOperationalData();
  const canManage = access.isMaster || access.permissions["technical.prods.manage"];
  const canCheck = access.isMaster || access.permissions["technical.prods.check"];
  const canApprove = access.isMaster || access.permissions["technical.prods.approve"];
  const canConfirmSupplies = access.isMaster || access.permissions["technical.deliveries.suprimentos_confirm"];
  const canConfirmProduction = access.isMaster || access.permissions["technical.deliveries.producao_confirm"];

  return (
    <div className="space-y-6">
      <PageHeader title="PRODs Técnicos" description="Montagem, conferência, aprovação, entregas e confirmações departamentais." />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader title="Lotes PROD" />
          <PanelBody className="space-y-3">
            {snapshot.prodBatches.map((prod) => {
              const contract = snapshot.contracts.find((item) => item.id === prod.contract_id);
              const links = snapshot.prodBatchPieces.filter((link) => link.prod_batch_id === prod.id);
              const pieces = snapshot.pieces.filter((piece) => links.some((link) => link.piece_id === piece.id));
              const deliveries = snapshot.deliveries.filter((delivery) => delivery.prod_batch_id === prod.id);
              return (
                <article key={prod.id} className="rounded-md border border-border bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/tecnico/contratos/${prod.contract_id}`} className="font-semibold text-charcoal hover:text-accent">
                        PROD {prod.batch_number} · {contract?.contract_number ?? "Contrato"}
                      </Link>
                      <p className="mt-1 text-muted-foreground">{pieces.map((piece) => piece.code).join(", ") || "Sem peças"}</p>
                    </div>
                    <StatusBadge status={prod.status} type="prod" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canCheck && prod.status === "aguardando_conferencia" ? (
                      <form action={checkProdBatchFormAction}><input type="hidden" name="id" value={prod.id} /><button className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Conferir</button></form>
                    ) : null}
                    {canApprove && prod.status === "aguardando_aprovacao" ? (
                      <form action={approveProdBatchFormAction}><input type="hidden" name="id" value={prod.id} /><button className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-orange-500">Aprovar</button></form>
                    ) : null}
                  </div>
                  {canManage && prod.status === "aprovado" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <ActionForm action={deliverDepartmentDocumentAction} submitLabel="Entregar lista">
                        <input type="hidden" name="prod_batch_id" value={prod.id} />
                        <input type="hidden" name="department" value="suprimentos" />
                        <input type="hidden" name="delivery_type" value="lista_materiais" />
                      </ActionForm>
                      <ActionForm action={deliverDepartmentDocumentAction} submitLabel="Entregar ordem">
                        <input type="hidden" name="prod_batch_id" value={prod.id} />
                        <input type="hidden" name="department" value="producao" />
                        <input type="hidden" name="delivery_type" value="ordem_producao" />
                      </ActionForm>
                    </div>
                  ) : null}
                  {deliveries.length ? (
                    <div className="mt-3 space-y-2">
                      {deliveries.map((delivery) => {
                        const canConfirm =
                          delivery.department === "suprimentos" ? canConfirmSupplies : canConfirmProduction;
                        return (
                          <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
                            <span className="text-xs text-muted-foreground">{delivery.delivery_type} · {delivery.department} · {delivery.status}</span>
                            {canConfirm && delivery.status === "entregue" ? (
                              <form action={confirmDepartmentDeliveryFormAction}>
                                <input type="hidden" name="id" value={delivery.id} />
                                <input type="hidden" name="department" value={delivery.department} />
                                <button className="rounded-md bg-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">Confirmar</button>
                              </form>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!snapshot.prodBatches.length ? <p className="text-sm text-muted-foreground">Nenhum PROD montado.</p> : null}
          </PanelBody>
        </Panel>
        {canManage ? (
          <Panel>
            <PanelHeader title="Montar PROD" />
            <PanelBody>
              <ActionForm action={createProdBatchAction} submitLabel="Montar PROD">
                <Field label="Contrato">
                  <select name="contract_id" className={inputClass} required>
                    <option value="">Selecione</option>
                    {snapshot.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_number}</option>)}
                  </select>
                </Field>
                <Field label="Número do PROD"><input name="batch_number" className={inputClass} required /></Field>
                <Field label="Descrição"><textarea name="description" className={textareaClass} /></Field>
                <Field label="Peças liberadas e conferidas">
                  <select name="piece_ids" multiple className="min-h-56 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-accent">
                    {snapshot.pieces
                      .filter((piece) => piece.status === "liberada" && piece.cem_registered && piece.cem_checked && !piece.active_prod_batch_id)
                      .map((piece) => <option key={piece.id} value={piece.id}>{piece.code} · {piece.environment ?? "Sem ambiente"}</option>)}
                  </select>
                </Field>
              </ActionForm>
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
