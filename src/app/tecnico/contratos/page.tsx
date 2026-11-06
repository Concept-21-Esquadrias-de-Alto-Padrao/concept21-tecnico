import styles from "./works-tones.module.css";
import { readDashboardPreview } from "@/lib/dashboard-preview";
import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";
import { ContractCreateActions } from "@/components/contract-create-actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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

  const preview = await readDashboardPreview(access.isMaster);
  const snapshot = preview?.snapshot ?? await getTechnicalContractsData();
  const today = new Intl.DateTimeFormat("sv-SE", {timeZone:"America/Sao_Paulo"}).format(new Date());
  const overviews = buildContractOverviews(snapshot);
  const canImport = access.isMaster || Boolean(access.permissions["technical.contracts.import_pdf"]);
  const canManualCreate = access.isMaster || Boolean(access.permissions["technical.contracts.manual_create"]);

  return (
    <div className={`${styles.works} space-y-4`}>
      {preview && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><strong>Homologação · Obras reais em consulta.</strong> Cópia de {new Date(preview.capturedAt).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})}. Busca, filtros e ordenação disponíveis. Cadastro e abertura das obras desabilitados nesta cópia.</p>}
      <PageHeader
        title="Contratos"
        description="Encontre a obra, compare as liberações e acompanhe o que ainda precisa avançar."
        actions={preview ? <button disabled className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white opacity-70" title="Cadastro desabilitado na cópia de consulta">+ Adicionar contrato</button> : (canImport || canManualCreate) ? (
          <ContractCreateActions
            canImport={canImport}
            canManualCreate={canManualCreate}
            profiles={canManualCreate ? snapshot.profiles.map(({ id, name }) => ({ id, name })) : []}
          />
        ) : undefined}
      />
      <section aria-label="Contratos cadastrados">
        {overviews.length ? (
          <TechnicalContractsTable overviews={overviews} today={today} readOnly={Boolean(preview)} />
        ) : (
          <EmptyState icon={ClipboardList} title="Nenhum contrato técnico cadastrado" description="Nenhum registro disponível." />
        )}
      </section>
    </div>
  );
}
