"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { ACTIVITIES_CHANGED_EVENT } from "@/lib/my-activities-events";
import { cn } from "@/lib/utils";

export type ActionState = {
  ok: boolean;
  message: string;
};

const initialState: ActionState = {
  ok: false,
  message: "",
};

function restoreFormValues(form: HTMLFormElement, formData: FormData) {
  const controls = Array.from(form.elements);
  const seenByName = new Map<string, number>();
  for (const control of controls) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) continue;
    if (!control.name) continue;

    const values = formData.getAll(control.name).map(String);
    const occurrence = seenByName.get(control.name) ?? 0;
    seenByName.set(control.name, occurrence + 1);
    const value = values[occurrence] ?? values.at(-1) ?? "";
    if (control instanceof HTMLInputElement) {
      if (["button", "file", "image", "reset", "submit"].includes(control.type)) continue;
      if (control.type === "checkbox" || control.type === "radio") {
        control.checked = values.includes(control.value || "on");
        continue;
      }
      control.value = value;
      continue;
    }

    if (control instanceof HTMLSelectElement) {
      if (control.multiple) {
        for (const option of Array.from(control.options)) option.selected = values.includes(option.value);
      } else {
        control.value = values.at(-1) ?? "";
      }
      continue;
    }

    control.value = value;
  }
}

export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  confirmMessage,
  onSuccess,
  onPendingChange,
  preserveOnError,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  confirmMessage?: string;
  onSuccess?: (message: string) => void;
  onPendingChange?: (pending: boolean) => void;
  preserveOnError?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastSubmittedData = useRef<FormData | null>(null);
  const [state, formAction, pending] = useActionState(action, initialState);
  useEffect(() => {
    if (!state.ok) return;
    lastSubmittedData.current = null;
    window.dispatchEvent(new Event(ACTIVITIES_CHANGED_EVENT));
    router.refresh();
  }, [router, state]);
  useEffect(() => {
    if (state.ok) onSuccess?.(state.message);
  }, [state, onSuccess]);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  useEffect(() => {
    if (!preserveOnError || state.ok || !state.message || !formRef.current || !lastSubmittedData.current) return;
    restoreFormValues(formRef.current, lastSubmittedData.current);
  }, [preserveOnError, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={cn("space-y-4", className)}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        if (preserveOnError) lastSubmittedData.current = new FormData(event.currentTarget);
      }}
    >
      {children}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? "Salvando..." : submitLabel}
        </button>
        {state.message ? (
          <p
            role={state.ok ? "status" : "alert"}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium",
              state.ok
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800",
            )}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-semibold text-charcoal">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-charcoal outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-orange-200";

export const textareaClass =
  "min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-charcoal outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-orange-200";
