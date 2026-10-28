import { CommercialEntryPage } from "@/components/commercial-entry-page";
import { requirePermissionAccess, getCurrentPermissionFlags } from "@/lib/server-access";

export default async function ContractEntryPage() {
  await requirePermissionAccess("technical.contracts.import_pdf");
  const access = await getCurrentPermissionFlags(["technical.contracts.import_pdf", "technical.contracts.manual_create"]);
  return <CommercialEntryPage mode="pdf" canImport={access.isMaster || Boolean(access.permissions["technical.contracts.import_pdf"])} canManualCreate={access.isMaster || Boolean(access.permissions["technical.contracts.manual_create"])} />;
}
