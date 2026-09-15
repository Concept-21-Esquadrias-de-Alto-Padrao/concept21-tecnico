import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyActivities } from "./my-activities-server";
import { getCurrentPermissionFlags, HttpError, requireAuthenticatedProfile } from "./server-access";
import { GET } from "@/app/api/technical/my-activities/route";
import { TECHNICAL_PERMISSIONS } from "./module-access";

vi.mock("server-only", () => ({}));
vi.mock("./server-access", async (original) => ({ ...await original<typeof import("./server-access")>(), requireAuthenticatedProfile: vi.fn(), getCurrentPermissionFlags: vi.fn() }));
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let requests: URL[];
let failure: string | null;

beforeEach(() => {
  failure = null;
  requests = [];
  tables = {
    production_contracts: [{ id: "contract", company_id: "company", active: true, contract_number: "26-0715", work_name: "Beoos" }],
    technical_contracts: [{ company_id: "company", contract_id: "contract", commercial_folder_received: true, deleted_at: null }],
    technical_actions: [{ id: "mine", company_id: "company", contract_id: "contract", responsible_profile_id: "me", title: "Minha ação", status: "aberta", deleted_at: null, due_date: null, blocking: false },
      { id: "other", company_id: "company", contract_id: "contract", responsible_profile_id: "other", title: "Outra pessoa", status: "aberta", deleted_at: null }],
    technical_corrections: [], technical_stage_validations: [], technical_stage_validation_participants: [],
    technical_releases: [], technical_release_participants: [], technical_closing_meetings: [], technical_visits: [], technical_prod_batches: [], technical_doubts: [],
  };
  const fetchMock: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const table = url.pathname.split("/").at(-1)!;
    if (table === "technical_contracts" && url.searchParams.get("order") !== "contract_id.asc") {
      return Response.json({ code: "42703", message: "column technical_contracts.id does not exist" }, { status: 400 });
    }
    if (failure === table) return Response.json({ code: "42P01", message: "relation technical_actions does not exist" }, { status: 500 });
    const rows = tables[table];
    if (!rows) throw new Error(`Unexpected table ${table}`);
    const filtered = rows.filter((row) => Array.from(url.searchParams).every(([key, value]) => {
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value === "is.null") return row[key] == null;
      if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(row[key]));
      if (value.startsWith("not.in.(")) return !value.slice(8, -1).split(",").includes(String(row[key]));
      return true;
    }));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    const columns = url.searchParams.get("select")!.split(",");
    return Response.json(filtered.slice(offset, offset + limit).map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))));
  };
  const admin = createClient("https://test.supabase.co", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
  vi.mocked(requireAuthenticatedProfile).mockResolvedValue({ admin, profile: { id: "me", company_id: "company", status: "active" } } as Awaited<ReturnType<typeof requireAuthenticatedProfile>>);
  vi.mocked(getCurrentPermissionFlags).mockResolvedValue({ isMaster: false, permissions: Object.fromEntries(TECHNICAL_PERMISSIONS.map((key) => [key, true])) });
});

describe("my activities server boundary", () => {
  it("uses the authenticated profile and company in queries and returns only its pending work", async () => {
    expect(await getMyActivities()).toMatchObject([{ id: "action-mine" }]);
    expect(requests.every((url) => url.searchParams.get("company_id") === "eq.company")).toBe(true);
    const actions = requests.find((url) => url.pathname.endsWith("/technical_actions"))!;
    expect(actions.searchParams.get("responsible_profile_id")).toBe("eq.me");
  });
  it("reads other people's prerequisites without exposing their action details", async () => {
    tables.technical_stage_validations.push({ id: "v", company_id: "company", contract_id: "contract", stage: "acoes", validation_required: true });
    tables.technical_stage_validation_participants.push({ id: "p", company_id: "company", contract_id: "contract", stage: "acoes", profile_id: "me", signed_at: null });
    tables.technical_actions[0].status = "concluida";
    const items = await getMyActivities();
    expect(items).toMatchObject([{ kind: "stage_signature", available: false }]);
    expect(JSON.stringify(items)).not.toContain("Outra pessoa");
    tables.technical_actions[1].status = "concluida";
    expect(await getMyActivities()).toMatchObject([{ available: true }]);
  });
  it("paginates instead of silently truncating at the database row limit", async () => {
    tables.technical_actions = Array.from({ length: 1101 }, (_, i) => ({ ...tables.technical_actions[0], id: `a-${i}` }));
    expect(await getMyActivities()).toHaveLength(1101);
    expect(requests.filter((url) => url.pathname.endsWith("/technical_actions"))).toHaveLength(3);
  });
  it("checks meeting signatures even when this user only participates in the folder stage", async () => {
    tables.technical_actions = [];
    for (const stage of ["entrada_comercial", "reuniao_ata"]) {
      tables.technical_stage_validations.push({ id: stage, company_id: "company", contract_id: "contract", stage, validation_required: true });
    }
    tables.technical_stage_validation_participants.push(
      { id: "mine", company_id: "company", contract_id: "contract", stage: "entrada_comercial", profile_id: "me", signed_at: null },
      { id: "other", company_id: "company", contract_id: "contract", stage: "reuniao_ata", profile_id: "other", signed_at: null },
    );
    expect(await getMyActivities()).toMatchObject([{ available: false }]);
    tables.technical_closing_meetings.push({ id: "meeting", company_id: "company", contract_id: "contract", status: "concluida" });
    expect(await getMyActivities()).toMatchObject([{ available: false, nextStep: "Aguardando as assinaturas da reunião e ata." }]);
    tables.technical_stage_validation_participants[1].signed_at = "today";
    expect(await getMyActivities()).toMatchObject([{ available: true }]);
  });
  it("does not query signatures or corrections without their view permissions", async () => {
    vi.mocked(getCurrentPermissionFlags).mockResolvedValue({ isMaster: false, permissions: { "technical.actions.view": true } });
    expect(await getMyActivities()).toHaveLength(1);
    expect(requests.some((url) => /participants|corrections|stage_validations/.test(url.pathname))).toBe(false);
  });
  it("never queries operational records for an unauthenticated or unauthorized caller", async () => {
    vi.mocked(requireAuthenticatedProfile).mockRejectedValueOnce(new HttpError(401, "Sessão não encontrada."));
    expect((await GET()).status).toBe(401);
    vi.mocked(getCurrentPermissionFlags).mockResolvedValue({ isMaster: false, permissions: {} });
    expect((await GET()).status).toBe(403);
    expect(requests).toEqual([]);
  });
  it("returns no-store personal data and friendly errors instead of an empty success", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    failure = "technical_actions";
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failed = await GET();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "Não foi possível consultar suas atividades. Tente atualizar novamente." });
    log.mockRestore();
  });
});
