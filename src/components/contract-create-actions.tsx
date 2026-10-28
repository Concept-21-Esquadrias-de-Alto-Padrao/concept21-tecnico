import Link from "next/link";
import { FileUp, Plus } from "lucide-react";
import type { Profile } from "@/lib/types";

export function ContractCreateActions({ canImport, canManualCreate }: {
  canImport: boolean;
  canManualCreate: boolean;
  profiles: Pick<Profile, "id" | "name">[];
}) {
  return <div className="flex flex-wrap gap-2">
    {canImport && <Link href="/tecnico/contratos/importar" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 text-sm font-semibold text-white hover:bg-charcoal/90"><FileUp className="size-4" />Importar PDF</Link>}
    {canManualCreate && <Link href="/tecnico/contratos/novo" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold hover:bg-muted/50"><Plus className="size-4" />Novo contrato</Link>}
  </div>;
}
