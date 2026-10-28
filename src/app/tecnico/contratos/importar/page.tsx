import { CommercialEntryPage } from "@/components/commercial-entry-page";
import { requirePermissionAccess } from "@/lib/server-access";

export default async function ContractEntryPage() {
  await requirePermissionAccess("technical.contracts.import_pdf");
  return <CommercialEntryPage mode="pdf" />;
}
