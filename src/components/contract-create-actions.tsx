"use client";

import { FileUp, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ContractImportPanel } from "@/components/contract-import-panel";
import { ManualContractForm } from "@/components/manual-contract-form";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "pdf" | "manual";
type ProfileOption = Pick<Profile, "id" | "name">;
const discardMessage = "Existem alterações não salvas. Deseja fechar e descartar o preenchimento?";

function ContractCreationDialog({ mode, profiles, onClose, onSuccess }: {
  mode: Mode;
  profiles: ProfileOption[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    titleRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (!dirty && !saving) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty, saving]);

  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm(discardMessage)) return;
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]',
        )).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first) {
          event.preventDefault();
          titleRef.current?.focus();
          return;
        }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
      }}
      className={cn(
        "fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none overflow-hidden border-0 bg-white p-0 text-charcoal shadow-xl backdrop:bg-black/45 open:flex open:flex-col sm:m-auto sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)] sm:rounded-lg",
        mode === "pdf" ? "sm:h-[calc(100dvh-3rem)] sm:max-w-[1400px]" : "sm:h-auto sm:max-w-3xl",
      )}
    >
      <header className="flex flex-none items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <h2 ref={titleRef} id={titleId} tabIndex={-1} className="text-lg font-semibold outline-none">
          {mode === "pdf" ? "Importar contrato por PDF" : "Novo contrato"}
        </h2>
        <button type="button" onClick={requestClose} disabled={saving} aria-label="Fechar janela" title={saving ? "Aguarde o término da gravação" : "Fechar janela"} className="inline-flex size-11 flex-none items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-40">
          <X className="size-5" />
        </button>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 [&_input]:min-w-0 [&_select]:min-w-0 [&_textarea]:min-w-0">
        {mode === "pdf" ? (
          <ContractImportPanel onDirtyChange={setDirty} onPendingChange={setSaving} onSuccess={onSuccess} />
        ) : (
          <ManualContractForm profiles={profiles} saving={saving} onDirtyChange={setDirty} onPendingChange={setSaving} onSuccess={onSuccess} />
        )}
      </div>
    </dialog>
  );
}

export function ContractCreateActions({ canImport, canManualCreate, profiles }: {
  canImport: boolean;
  canManualCreate: boolean;
  profiles: ProfileOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [notice, setNotice] = useState("");
  const close = useCallback(() => setMode(null), []);
  const saved = useCallback((message: string) => {
    setMode(null);
    setNotice(message);
    router.refresh();
  }, [router]);
  const visibleMode = (mode === "pdf" && canImport) || (mode === "manual" && canManualCreate) ? mode : null;
  function open(next: Mode) { setNotice(""); setMode(next); }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2">
        {canImport ? <button type="button" onClick={() => open("pdf")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-black"><FileUp className="size-4" />Importar PDF</button> : null}
        {canManualCreate ? <button type="button" onClick={() => open("manual")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:bg-muted"><Plus className="size-4" />Novo contrato</button> : null}
      </div>
      {notice ? <p role="status" className="max-w-xl text-sm font-medium text-success">{notice}</p> : null}
      {visibleMode ? <ContractCreationDialog key={visibleMode} mode={visibleMode} profiles={profiles} onClose={close} onSuccess={saved} /> : null}
    </div>
  );
}
