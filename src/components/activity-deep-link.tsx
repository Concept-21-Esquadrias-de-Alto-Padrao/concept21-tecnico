"use client";

import { useEffect } from "react";

export function ActivityDeepLink() {
  useEffect(() => {
    function reveal() {
      const id = window.location.hash.slice(1);
      if (!/^(atividade-|assinatura-|lote-)/.test(id)) return;
      const target = document.getElementById(id);
      if (!target) return;
      for (let element: HTMLElement | null = target; element; element = element.parentElement) {
        if (element instanceof HTMLDetailsElement) element.open = true;
      }
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return null;
}
