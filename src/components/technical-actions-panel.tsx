import { TechnicalActionsCenter } from "@/components/technical-actions-center";
import { getWorkItemPermissions, type PermissionLookup } from "@/lib/module-access";
import { buildTechnicalWorkItems, type WorkItemFilters } from "@/lib/technical-work-items";
import type { TechnicalSnapshot } from "@/lib/types";

export function TechnicalActionsPanel({ snapshot, access, contractId, initialKind = "all" }: {
  snapshot: TechnicalSnapshot;
  access: PermissionLookup;
  contractId?: string;
  initialKind?: WorkItemFilters["kind"];
}) {
  const permissions = getWorkItemPermissions(access);
  return <TechnicalActionsCenter
    key={`${contractId ?? "all"}-${initialKind}`}
    {...permissions}
    contractId={contractId}
    initialKind={initialKind}
    items={buildTechnicalWorkItems(
      permissions.canViewActions ? snapshot.actions : [],
      permissions.canViewCorrections ? snapshot.corrections : [],
    )}
    contracts={snapshot.contracts.map(({ id, contract_number, work_name }) => ({ id, contract_number, work_name }))}
    profiles={snapshot.profiles.map(({ id, name }) => ({ id, name }))}
    pieces={snapshot.pieces.map(({ id, contract_id, code, environment }) => ({ id, contract_id, code, environment }))}
    prods={snapshot.prodBatches.map(({ id, contract_id, batch_number }) => ({ id, contract_id, batch_number }))}
  />;
}
