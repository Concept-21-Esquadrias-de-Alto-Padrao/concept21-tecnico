"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { MyActivity } from "@/lib/my-activities";
import { ACTIVITIES_CHANGED_EVENT } from "@/lib/my-activities-events";

type ActivitiesState = { items: MyActivity[]; loading: boolean; error: string; refresh: () => void };
const ActivitiesContext = createContext<ActivitiesState | null>(null);

export function MyActivitiesProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<Omit<ActivitiesState, "refresh"> & { loadedPath: string | null }>({ items: [], loading: enabled, error: "", loadedPath: null });
  const request = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);
  const load = useCallback(() => {
    if (!enabled) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    lastAttempt.current = Date.now();
    return fetch("/api/technical/my-activities", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível consultar suas atividades.");
        return payload.items as MyActivity[];
      })
      .then((items) => {
        if (!controller.signal.aborted) setState({ items, loading: false, error: "", loadedPath: pathname });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ items: [], loading: false, loadedPath: pathname, error: error instanceof Error && error.message.startsWith("Sua sessão")
          ? error.message : "Não foi possível consultar suas atividades. Tente atualizar novamente." });
      });
  }, [enabled, pathname]);
  const refresh = useCallback(() => {
    if (!enabled) return;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    void load();
  }, [enabled, load]);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);

  useEffect(() => {
    function focus() {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt.current >= 60_000) void refresh();
    }
    function changed() { void refresh(); }
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    window.addEventListener(ACTIVITIES_CHANGED_EVENT, changed);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener(ACTIVITIES_CHANGED_EVENT, changed);
    };
  }, [refresh]);

  return <ActivitiesContext.Provider value={{ items: state.items, error: state.error, loading: enabled && (state.loading || state.loadedPath !== pathname), refresh }}>{children}</ActivitiesContext.Provider>;
}

export function useMyActivities() {
  const value = useContext(ActivitiesContext);
  if (!value) throw new Error("MyActivitiesProvider não encontrado.");
  return value;
}

export function MyActivitiesCount() {
  const { items, loading, error } = useMyActivities();
  if (error) return <span title="Não foi possível atualizar as atividades" aria-label="Atividades indisponíveis">!</span>;
  if (loading) return <span className="ml-auto w-7 text-center text-xs" aria-label="Atualizando atividades">...</span>;
  if (!items.length) return null;
  return <span className="ml-auto min-w-7 rounded-md bg-accent px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-accent-foreground" aria-label={`${items.length} atividades pendentes`}>{items.length > 99 ? "99+" : items.length}</span>;
}
