import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommercialEntryOptions } from "@/components/commercial-entry-options";
import { getCurrentPermissionFlags } from "@/lib/server-access";

export default async function AddContractPage() {
  const access = await getCurrentPermissionFlags(["technical.contracts.import_pdf", "technical.contracts.manual_create"]);
  const canImport = access.isMaster || Boolean(access.permissions["technical.contracts.import_pdf"]);
  const canManualCreate = access.isMaster || Boolean(access.permissions["technical.contracts.manual_create"]);
  if (!canImport && !canManualCreate) redirect("/tecnico/contratos");
  return <div className="space-y-6">
    <nav aria-label="Localização" className="flex gap-2 text-sm text-muted-foreground"><Link href="/tecnico/contratos">Obras</Link><span>/</span><span>Adicionar obra</span></nav>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-700">Recebimento do contrato</p><h1 className="text-3xl font-semibold tracking-tight">Adicionar obra</h1><p className="mt-2 text-sm text-muted-foreground">Escolha como começar. Nos dois caminhos, você confere as informações antes de salvar.</p></div><Link href="/tecnico/contratos" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium"><ArrowLeft className="size-4" />Voltar para Obras</Link></div>
    <CommercialEntryOptions canImport={canImport} canManualCreate={canManualCreate} />
    <p className="text-sm text-muted-foreground">Já tem o PDF do desenho ou contrato? Comece pela importação para aproveitar os dados do documento.</p>
  </div>;
}
