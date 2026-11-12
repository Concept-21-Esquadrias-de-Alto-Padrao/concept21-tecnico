import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/auth/portal-logout" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { AuthGate } from "./auth-gate";

describe("logout without a Technical session", () => {
  beforeEach(() => { navigation.pathname = "/auth/portal-logout"; });
  it("renders the logout step immediately, including when authentication is absent", () => {
    expect(renderToStaticMarkup(<AuthGate><p>Encerrando sessões</p></AuthGate>)).toContain("Encerrando sessões");
  });
  it.each(["/tecnico", "/auth/portal-logout/other"])("continues protecting other routes: %s", (pathname) => {
    navigation.pathname = pathname;
    const html = renderToStaticMarkup(<AuthGate><p>Conteúdo privado</p></AuthGate>);
    expect(html).not.toContain("Conteúdo privado");
    expect(html).toContain("Validando sessão");
  });
});
