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

  const snapshot = await getTechnicalContractsData();
  const overviews = buildContractOverviews(snapshot);
  const canImport = access.isMaster || Boolean(access.permissions["technical.contracts.import_pdf"]);
  const canManualCreate = access.isMaster || Boolean(access.permissions["technical.contracts.manual_create"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos Técnicos"
        actions={canImport || canManualCreate ? (
          <ContractCreateActions
            canImport={canImport}
            canManualCreate={canManualCreate}
            profiles={canManualCreate ? snapshot.profiles.map(({ id, name }) => ({ id, name })) : []}
          />
        ) : undefined}
      />
      <section aria-label="Contratos cadastrados">
        {overviews.length ? (
          <TechnicalContractsTable overviews={overviews} />
        ) : (
          <EmptyState icon={ClipboardList} title="Nenhum contrato técnico cadastrado" description="Nenhum registro disponível." />
        )}
      </section>
    </div>
  );
}
