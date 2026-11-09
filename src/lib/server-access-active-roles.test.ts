import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentPermissionFlags, hasActiveMasterRole, requireMasterAccess, requirePermissionAccess } from "./server-access";
import type { Profile } from "./types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/corporate-access-server", () => ({ checkCorporateAccess: vi.fn().mockResolvedValue("allowed") }));
vi.mock("@/lib/system-maintenance-server", () => ({ getSystemMaintenanceState: vi.fn().mockResolvedValue({ enabled: false }) }));
vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createSupabaseServerClient: async () => ({ auth: {
    getUser: async () => ({ data: { user: { id: "user", email: "test@example.invalid" } }, error: null }),
    getSession: async () => ({ data: { session: { access_token: "token" } } }),
  } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => admin }));
let admin: ReturnType<typeof createClient>;
let tables: Record<string, Record<string, unknown>[]>;
const profile = { id: "profile", user_id: "user", company_id: "company", status: "active", is_master: false } as Profile;

beforeEach(() => {
  tables = {
    profiles: [profile as unknown as Record<string, unknown>],
    user_roles: [{ id: "grant", profile_id: "profile", company_id: "company", role_id: "role", active: false }],
    roles: [{ id: "role", company_id: "company", active: true, is_master_role: true }],
    permissions: [{ id: "permission", key: "technical.contracts.view" }],
    role_permissions: [{ id: "permission-grant", company_id: "company", role_id: "role", permission_id: "permission" }],
  };
  admin = createClient("https://test.example.com", "test-key", { auth: { persistSession: false }, global: {
    fetch: async (input, init) => {
      const url = new URL(String(input));
      const name = url.pathname.split("/").at(-1)!;
      const rows = tables[name];
      if (!rows) throw new Error("Unexpected table " + name);
      const filtered = rows.filter(row => Array.from(url.searchParams).every(([key,value]) =>
        value.startsWith("eq.") ? String(row[key]) === value.slice(3) :
        value.startsWith("in.(") ? value.slice(4,-1).split(",").includes(String(row[key])) : true));
      const singular = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object");
      return Response.json(singular ? filtered[0] ?? null : filtered);
    },
  } });
});

describe("active local roles remain authoritative", () => {
  it("an inactive grant cannot become Master or bypass permissions", async () => {
    expect(await hasActiveMasterRole(admin, profile)).toBe(false);
    await expect(requireMasterAccess()).rejects.toMatchObject({ status: 403 });
    await expect(requirePermissionAccess("technical.contracts.view")).rejects.toMatchObject({ status: 403 });
    expect(await getCurrentPermissionFlags(["technical.contracts.view"])).toEqual({
      isMaster: false, permissions: { "technical.contracts.view": false },
    });
  });
  it("retains an active reviewed Master grant", async () => {
    tables.user_roles[0].active = true;
    expect(await hasActiveMasterRole(admin, profile)).toBe(true);
    await expect(requireMasterAccess()).resolves.toMatchObject({ authUserId: "user" });
  });
  it("does not borrow a grant from another company", async () => {
    tables.user_roles[0].active = true;
    tables.user_roles[0].company_id = "other";
    expect(await hasActiveMasterRole(admin, profile)).toBe(false);
    await expect(requireMasterAccess()).rejects.toMatchObject({ status: 403 });
  });
});
