import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TechnicalActionsPanel } from "@/components/technical-actions-panel";
import { appNavigationPermissionKeys, canAccessModule, firstAllowedAppRoute, MODULE_ACCESS, TECHNICAL_PERMISSIONS } from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalOperationalData } from "@/lib/technical-data";

export default async function TechnicalActionsPage({ searchParams }: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const access = await getCurrentPermissionFlags([...appNavigationPermissionKeys, ...TECHNICAL_PERMISSIONS]);
  if (!canAccessModule(access, MODULE_ACCESS.actions)) redirect(firstAllowedAppRoute(access) ?? "/login");
  const [snapshot, filters] = await Promise.all([getTechnicalOperationalData(), searchParams]);
  return (
    <div className="space-y-6">
      <PageHeader title="Ações" />
      <TechnicalActionsPanel snapshot={snapshot} access={access} initialKind={filters.tipo === "correcao" ? "correction" : "all"} />
    </div>
  );
}
