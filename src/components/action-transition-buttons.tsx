"use client";

import { useActionState, useEffect } from "react";
import { transitionTechnicalActionFormAction } from "@/app/actions";
import { ACTIVITIES_CHANGED_EVENT } from "@/lib/my-activities-events";
import type { TechnicalAction } from "@/lib/types";
import { cn } from "@/lib/utils";

type ActionTransitionButtonsProps = {
  action: Pick<TechnicalAction, "id" | "status">;
  canManage: boolean;
  canValidate: boolean;
  className?: string;
};

type TransitionButtonProps = {
  actionId: string;
  disabled?: boolean;
  label: string;
  nextStatus: "em_andamento" | "concluida" | "validada";
  title?: string;
};

const buttonClass =
  "rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-charcoal transition hover:bg-muted disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60";

function TransitionButton({ actionId, disabled, label, nextStatus, title }: TransitionButtonProps) {
  const [state, submit, pending] = useActionState(
    (_previous: { ok: boolean; message: string }, formData: FormData) => transitionTechnicalActionFormAction(formData),
    { ok: false, message: "" },
  );
  useEffect(() => {
    if (state.ok) window.dispatchEvent(new Event(ACTIVITIES_CHANGED_EVENT));
  }, [state]);
  return (
    <form action={submit}>
      <input type="hidden" name="id" value={actionId} />
      <input type="hidden" name="next_status" value={nextStatus} />
      <button className={buttonClass} disabled={disabled || pending} title={title}>
        {pending ? "Salvando..." : label}
      </button>
      {!state.ok && state.message ? <p role="alert" className="mt-2 max-w-xs text-xs text-danger">{state.message}</p> : null}
    </form>
  );
}

export function ActionTransitionButtons({
  action,
  canManage,
  canValidate,
  className,
}: ActionTransitionButtonsProps) {
  if (!canManage) return null;

  const terminal = ["concluida", "cancelada"].includes(action.status);
  const canMoveToProgress = !terminal && !["em_andamento", "validada"].includes(action.status);
  const canConclude = action.status === "validada";
  const validateDisabled = terminal || !canValidate || action.status === "validada";

  return (
    <div className={cn("mt-3 flex flex-wrap gap-2", className)}>
      <TransitionButton
        actionId={action.id}
        disabled={!canMoveToProgress}
        label="Em andamento"
        nextStatus="em_andamento"
      />
      <TransitionButton
        actionId={action.id}
        disabled={validateDisabled}
        label="Validar"
        nextStatus="validada"
        title={!canValidate ? "Somente Gestor Técnico ou Administrador pode validar." : undefined}
      />
      <TransitionButton
        actionId={action.id}
        disabled={!canConclude}
        label="Concluir"
        nextStatus="concluida"
        title={!canConclude ? "A ação precisa ser validada antes da conclusão." : undefined}
      />
    </div>
  );
}
