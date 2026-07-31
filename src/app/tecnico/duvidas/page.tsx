import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { answerDoubtAction, createDoubtAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalOperationalData } from "@/lib/technical-data";

export default async function TechnicalDoubtsPage() {
  const access = await getCurrentPermissionFlags([...appNavigationPermissionKeys, ...TECHNICAL_PERMISSIONS]);
  if (!canAccessModule(access, MODULE_ACCESS.doubts)) redirect(firstAllowedAppRoute(access) ?? "/login");
  const snapshot = await getTechnicalOperationalData();
  const canManage = access.isMaster || access.permissions["technical.doubts.manage"];

  return (
    <div className="space-y-6">
      <PageHeader title="Base de Dúvidas" description="Bases separadas para Produção e Obras/Instalações." />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4">
          {(["producao", "obras_instalacoes"] as const).map((area) => (
            <Panel key={area}>
              <PanelHeader title={area === "producao" ? "Dúvidas da Produção" : "Dúvidas de Obras/Instalações"} />
              <PanelBody className="space-y-3">
                {snapshot.doubts.filter((doubt) => doubt.area === area).map((doubt) => (
                  <article key={doubt.id} className="rounded-md border border-border bg-white p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="mt-0.5 size-4 flex-none text-accent" />
                      <div>
                        <p className="font-semibold text-charcoal">{doubt.question}</p>
                        <p className="mt-1 text-muted-foreground">{doubt.answer ?? "Sem resposta."}</p>
                        {doubt.contract_id ? <Link href={`/tecnico/contratos/${doubt.contract_id}`} className="mt-2 inline-block text-xs font-semibold text-accent">Abrir contrato</Link> : null}
                      </div>
                    </div>
                    {canManage && doubt.status === "aberta" ? (
                      <ActionForm action={answerDoubtAction} submitLabel="Responder" className="mt-3 rounded-md bg-muted/40 p-3">
                        <input type="hidden" name="id" value={doubt.id} />
                        <Field label="Resposta"><textarea name="answer" className={textareaClass} required /></Field>
                        <label className="flex items-center gap-2 text-sm font-semibold text-charcoal"><input name="frequent" type="checkbox" /> Publicar como frequente</label>
                      </ActionForm>
                    ) : null}
                  </article>
                ))}
              </PanelBody>
            </Panel>
          ))}
        </div>
        {canManage ? (
          <Panel>
            <PanelHeader title="Nova dúvida" />
            <PanelBody>
              <ActionForm action={createDoubtAction} submitLabel="Registrar dúvida">
                <Field label="Base">
                  <select name="area" className={inputClass}>
                    <option value="producao">Produção</option>
                    <option value="obras_instalacoes">Obras/Instalações</option>
                  </select>
                </Field>
                <Field label="Contrato">
                  <select name="contract_id" className={inputClass}>
                    <option value="">Sem contrato</option>
                    {snapshot.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_number}</option>)}
                  </select>
                </Field>
                <Field label="Categoria"><input name="category" className={inputClass} /></Field>
                <Field label="Dúvida"><textarea name="question" className={textareaClass} required /></Field>
              </ActionForm>
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
