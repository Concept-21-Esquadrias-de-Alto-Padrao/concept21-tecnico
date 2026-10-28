import Link from "next/link";
import { Plus } from "lucide-react";
import type { Profile } from "@/lib/types";

export function ContractCreateActions({ canImport, canManualCreate }: {
  canImport: boolean;
  canManualCreate: boolean;
  profiles: Pick<Profile, "id" | "name">[];
}) {
  if (!canImport && !canManualCreate) return null;
  return <Link href="/tecnico/contratos/adicionar" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 text-sm font-semibold text-white hover:bg-charcoal/90"><Plus className="size-4" />Adicionar obra</Link>;
}
