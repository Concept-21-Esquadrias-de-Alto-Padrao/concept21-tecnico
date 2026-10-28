import { CommercialEntryPage } from "@/components/commercial-entry-page";
import { requirePermissionAccess, getCurrentPermissionFlags } from "@/lib/server-access";

export default async function ContractEntryPage() {
  await requirePermissionAccess("technical.contracts.manual_create");
  const access = await getCurrentPermissionFlags(["technical.contracts.import_pdf", "technical.contracts.manual_create"]);
  return <CommercialEntryPage mode="manual" canImport={access.isMaster || Boolean(access.permissions["technical.contracts.import_pdf"])} canManualCreate={access.isMaster || Boolean(access.permissions["technical.contracts.manual_create"])} />;
}
