import { notFound } from "next/navigation";
import { requirePermissionAccess } from "@/lib/server-access";
import { readReceipt } from "@/lib/commercial-receipt";
import { CommercialReceiptWizard } from "@/components/commercial-receipt-wizard";
export const dynamic = "force-dynamic";
export default async function ReceiptPage({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const context = await requirePermissionAccess("technical.contracts.view");
  const {data,error} = await context.admin.from("technical_contracts").select("commercial_data").eq("company_id",context.profile.company_id).eq("contract_id",id).is("deleted_at",null).maybeSingle();
  if (error) throw error;
  const receipt = readReceipt(data?.commercial_data);
  if (!receipt) notFound();
  await requirePermissionAccess(data!.commercial_data.origem_cadastro === "pdf" ? "technical.contracts.import_pdf" : "technical.contracts.manual_create");
  const {data: owner} = await context.admin.from("profiles").select("name").eq("company_id",context.profile.company_id).eq("id",receipt.owner).maybeSingle();
  return <CommercialReceiptWizard contractId={id} initial={{...receipt,ownerName:owner?.name ?? receipt.ownerName}} />;
}
