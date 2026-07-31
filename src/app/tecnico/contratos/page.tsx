import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";
import { createManualContractAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { ContractImportPanel } from "@/components/contract-import-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { TechnicalContractsTable } from "@/components/technical-contracts-table";
import { buildContractOverviews, getTechnicalContractsData } from "@/lib/technical-data";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";

export default async function TechnicalContractsPage() {
  const access = await getCurrentPermissionFlags([
    ...appNavigationPermissionKeys,
    ...TECHNICAL_PERMISSIONS,
  ]);
  if (!canAccessModule(access, MODULE_ACCESS.contracts)) {
    redirect(firstAllowedAppRoute(access) ?? "/login");
  }

  const snapshot = await getTechnicalContractsData();
  const overviews = buildContractOverviews(snapshot);
  const canImport = access.isMaster || access.permissions["technical.contracts.import_pdf"];
  const canManualCreate = access.isMaster || access.permissions["technical.contracts.manual_create"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos Técnicos"
        description="Entrada por PDF com conferência humana, cadastro manual autorizado e lista operacional dos contratos vinculados à entidade central."
      />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        {canImport ? (
          <Panel>
            <PanelHeader title="Importar contrato por PDF" />
            <PanelBody>
              <ContractImportPanel />
            </PanelBody>
          </Panel>
        ) : null}

        {canManualCreate ? (
          <Panel>
            <PanelHeader
              title="Cadastro manual autorizado"
              description="Disponível para Gestor Técnico e Administrador; a permissão também é validada no servidor."
            />
            <PanelBody>
              <ActionForm action={createManualContractAction} submitLabel="Salvar contrato">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Número do contrato">
                    <input name="contract_number" className={inputClass} required />
                  </Field>
                  <Field label="Cliente">
                    <input name="client_name" className={inputClass} required />
                  </Field>
                  <Field label="Data do contrato">
                    <input name="contract_date" type="date" className={inputClass} />
                  </Field>
                  <Field label="Prazo">
                    <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                      <input name="contractual_deadline_value" type="number" min={0} className={inputClass} />
                      <select name="contractual_deadline_unit" className={inputClass} defaultValue="dias_uteis">
                        <option value="dias_uteis">Dias úteis</option>
                        <option value="dias_corridos">Dias corridos</option>
                      </select>
                    </div>
                  </Field>
                </div>
                <Field label="Obra">
                  <input name="work_name" className={inputClass} required />
                </Field>
                <Field label="Endereço da obra">
                  <input name="full_address" className={inputClass} required />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cidade">
                    <input name="city" className={inputClass} defaultValue="Goiânia" />
                  </Field>
                  <Field label="UF">
                    <input name="state" className={inputClass} defaultValue="GO" maxLength={2} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Técnico responsável">
                    <select name="technical_manager_profile_id" className={inputClass}>
                      <option value="">A definir</option>
                      {snapshot.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Acompanhamento">
                    <select name="followup_profile_id" className={inputClass}>
                      <option value="">A definir</option>
                      {snapshot.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Descrição / observações">
                  <textarea name="description" className={textareaClass} />
                </Field>
              </ActionForm>
            </PanelBody>
          </Panel>
        ) : null}
      </div>

      <Panel>
        <PanelHeader title="Contratos cadastrados" />
        <PanelBody>
          {overviews.length ? (
            <TechnicalContractsTable overviews={overviews} />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Nenhum contrato técnico cadastrado"
              description="Importe um PDF ou use o cadastro manual autorizado para iniciar o fluxo técnico."
            />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
