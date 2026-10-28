import Link from "next/link";
import { FileUp, PenLine, ArrowRight } from "lucide-react";

export function CommercialEntryOptions({ canImport, canManualCreate, mode }: { canImport: boolean; canManualCreate: boolean; mode?: "pdf" | "manual" }) {
  const options = [
    { enabled: canImport, value: "pdf", href: "/tecnico/contratos/importar", title: "Importar PDF", description: "Envie o desenho ou contrato e confira os dados extraídos antes de salvar.", icon: FileUp },
    { enabled: canManualCreate, value: "manual", href: "/tecnico/contratos/novo", title: "Cadastrar manualmente", description: "Preencha os dados da obra, os contatos e a previsão comercial.", icon: PenLine },
  ];
  return <nav aria-label="Como adicionar a obra" className="grid gap-4 sm:grid-cols-2">{options.filter(option => option.enabled).map(option => {
    const Icon = option.icon;
    const selected = mode === option.value;
    return <Link key={option.value} href={option.href} aria-current={selected ? "page" : undefined} className={`flex items-start gap-4 rounded-2xl border p-5 transition focus-visible:outline-2 focus-visible:outline-orange-600 ${selected ? "border-orange-400 bg-orange-50" : "border-border bg-white hover:border-orange-300 hover:bg-orange-50/40"}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-charcoal">{option.title}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{option.description}</span>{selected && <span className="mt-2 block text-xs font-semibold text-orange-800">Opção selecionada</span>}</span><ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
    </Link>;
  })}</nav>;
}
