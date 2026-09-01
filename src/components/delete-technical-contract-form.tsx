"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { deleteTechnicalContractAction } from "@/app/actions";
import type { ActionState } from "@/components/action-form";
import { inputClass, textareaClass } from "@/components/action-form";
import { cn } from "@/lib/utils";

const initialState: ActionState = {
  ok: false,
  message: "",
};

export function DeleteTechnicalContractForm({
  contractId,
  contractNumber,
}: {
  contractId: string;
  contractNumber: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteTechnicalContractAction, initialState);

  useEffect(() => {
    if (!state.ok) return;

    const timeout = window.setTimeout(() => {
      router.push("/tecnico/contratos");
      router.refresh();
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [router, state.ok]);

  return (
    <form
      action={formAction}
      className="rounded-md border border-red-200 bg-red-50 p-4"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Tem certeza que deseja excluir este contrato? Ele será retirado das telas operacionais e a ação ficará registrada na auditoria.",
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="contract_id" value={contractId} />
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h3 className="font-semibold text-red-900">Excluir contrato</h3>
          <p className="mt-2 text-sm text-red-800">
            Use somente quando o contrato foi lançado errado e precisa sair da operação. O histórico de auditoria será preservado.
          </p>
        </div>
        <div className="grid gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-red-950">
              Digite o número do contrato para confirmar
            </span>
            <input
              name="confirmation"
              className={inputClass}
              placeholder={contractNumber}
              autoComplete="off"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-red-950">Justificativa</span>
            <textarea
              name="reason"
              className={textareaClass}
              placeholder="Ex.: lançamento duplicado, contrato errado ou importação incorreta."
              minLength={5}
              required
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {pending ? "Excluindo..." : "Excluir contrato"}
            </button>
            {state.message ? (
              <p
                role={state.ok ? "status" : "alert"}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  state.ok
                    ? "border border-green-200 bg-green-50 text-green-800"
                    : "border border-red-200 bg-white text-red-800",
                )}
              >
                {state.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
