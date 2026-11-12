import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/platform-maintenance-gate",()=>({checkPlatformMaintenance:async()=>null}));
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";
import { config, proxy } from "@/proxy";

describe("Portal-only browser entry", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_PORTAL_ORIGIN", "https://concept21-portal.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-publishable-key");
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  });
  it.each(["/", "/tecnico", "/rh/colaboradores", "/tecnico/contratos/123", "/login?next=https://evil.example", "/cadastro", "/auth/callback"])("sends anonymous %s to the Portal chooser", async path => {
    const response = await proxy(new NextRequest("https://module.example" + path));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://concept21-portal.vercel.app/");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not trust the mere presence of a cookie", async () => {
    const response = await proxy(new NextRequest("https://module.example/tecnico", { headers: { cookie: "sb-auth-token=untrusted" } }));
    expect(response.status).toBe(303);
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });
  it("keeps a session verified by Supabase", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
    const response = await proxy(new NextRequest("https://module.example/tecnico"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
  it.each(["/auth/complete", "/auth/portal-entry", "/auth/portal-logout"])("keeps the exact transition %s reachable", async path => {
    expect((await proxy(new NextRequest("https://module.example" + path))).status).toBe(200);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("does not exempt children of a transition route", async () => {
    expect((await proxy(new NextRequest("https://module.example/auth/complete/other"))).status).toBe(303);
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });
  it("fails closed when verification fails", async () => {
    mocks.getUser.mockRejectedValue(new Error("unavailable"));
    expect((await proxy(new NextRequest("https://module.example/tecnico"))).status).toBe(303);
  });
  it("does not redirect to an unsafe configured origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_PORTAL_ORIGIN", "http://evil.example");
    const response = await proxy(new NextRequest("https://module.example/tecnico"));
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
  });
  it.each(["/", "/rh/colaboradores", "/tecnico/contratos/abc.png", "/login", "/cadastro","/api/auth/current-access","/api/internal/platform-install"])("intercepts the protected page or API %s", url => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
  });
  it.each(["/_next/static/chunk.js", "/brand/concept21-aluminium.png"])("keeps the static asset %s outside session checks", url => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
  });
});
