"use client";

import Link from "next/link";
import { CommercialEntryOptions } from "@/components/commercial-entry-options";
import { ArrowLeft, CheckCircle2, ClipboardCheck, FileUp, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ManualContractForm } from "@/components/manual-contract-form";
import { ContractImportPanel } from "@/components/contract-import-panel";

export function CommercialEntryPage({ mode, canImport, canManualCreate }: { mode: "manual" | "pdf"; canImport: boolean; canManualCreate: boolean }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if ((!dirty && !saving) || success) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeNavigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.getAttribute("href")?.startsWith("#")) return;
      if (saving || !window.confirm("Há informações não salvas. Deseja sair desta página e descartar o preenchimento?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeNavigate, true); };
  }, [dirty, saving, success]);
  function saved(message: string) { setDirty(false); setSuccess(message); router.refresh(); }
  return <div className="space-y-6">
    <nav aria-label="Localização" className="flex items-center gap-2 text-sm text-muted-foreground"><Link href="/tecnico/contratos" className="hover:text-charcoal">Obras</Link><span aria-hidden="true">/</span><span>Entrada comercial</span></nav>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-700">Recebimento do contrato</p><h1 className="text-2xl font-semibold tracking-tight text-charcoal sm:text-3xl">Adicionar obra</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Organize os dados comerciais, as pessoas autorizadas e a necessidade de entrega do cliente.</p></div>
      <Link href="/tecnico/contratos" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium"><ArrowLeft className="size-4" />Voltar para Obras</Link>
    </div>
    {!success && <CommercialEntryOptions canImport={canImport} canManualCreate={canManualCreate} mode={mode} />}
    {success ? <section className="rounded-2xl border border-green-200 bg-white p-8" role="status"><CheckCircle2 className="mb-4 size-9 text-green-700" /><h2 className="text-xl font-semibold">Cadastro salvo</h2><p className="mt-2 text-muted-foreground">{success}</p><Link href="/tecnico/contratos" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-charcoal px-5 text-sm font-semibold text-white">Ver obras cadastradas</Link></section> :
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section aria-label="Cadastro comercial" className="min-w-0 rounded-2xl border border-border/80 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-border/70 px-5 py-5 sm:px-7"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-700">{mode === "pdf" ? <FileUp className="size-5" /> : <ClipboardCheck className="size-5" />}</span><div><h2 className="font-semibold text-charcoal">{mode === "pdf" ? "Desenho e dados recebidos" : "Dados da obra"}</h2><p className="text-xs text-muted-foreground">Confira as informações antes de salvar.</p></div></div>
        <div className="min-w-0 p-5 sm:p-7 [&_input]:min-w-0 [&_select]:min-w-0 [&_textarea]:min-w-0">
          {mode === "pdf" ? <ContractImportPanel onDirtyChange={setDirty} onPendingChange={setSaving} onSuccess={saved} /> : <ManualContractForm profiles={[]} saving={saving} onDirtyChange={setDirty} onPendingChange={setSaving} onSuccess={saved} />}
        </div>
      </section>
      <aside aria-label="Orientações de preenchimento" className="space-y-4">
        <section className="rounded-2xl border border-border/80 bg-white p-5"><ClipboardCheck className="mb-3 size-5 text-orange-600" /><h2 className="font-semibold">O que conferir</h2><ul className="mt-4 space-y-4 text-sm text-muted-foreground"><li><strong className="block font-medium text-charcoal">Contrato e obra</strong>Número, cliente, endereço e prazo contratual.</li><li><strong className="block font-medium text-charcoal">Pessoas autorizadas</strong>Nome, função e contato de cada pessoa.</li><li><strong className="block font-medium text-charcoal">Previsão comercial</strong>Quando o cliente precisa das peças instaladas.</li>{mode === "pdf" && <li><strong className="block font-medium text-charcoal">Peças e desenho</strong>Revise códigos, ambientes, modelos e quantidades da prévia.</li>}</ul></section>
        <section className="rounded-2xl bg-[#edf1f4] p-5 text-sm"><UsersRound className="mb-3 size-5 text-slate-600" /><h2 className="font-semibold">Ainda sem data?</h2><p className="mt-2 leading-relaxed text-muted-foreground">Marque a opção no cadastro. Warlley alinha a necessidade na primeira visita e Anna acompanha o planejamento.</p></section>
      </aside>
    </div>}
  </div>;
}
