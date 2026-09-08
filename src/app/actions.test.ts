import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requirePermissionAccess } from "@/lib/server-access";
import { updateContractWorkDataAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server-access", () => ({
  requirePermissionAccess: vi.fn(),
  hasActiveMasterRole: vi.fn().mockResolvedValue(false),
}));

const companyId = "00000000-0000-4000-8000-000000000001";
const contractId = "00000000-0000-4000-8000-000000000002";
const clientId = "00000000-0000-4000-8000-000000000003";
const userId = "00000000-0000-4000-8000-000000000004";
const originalName = "Amir Rached Abboud";
const initialState = { ok: false, message: "" };

type Row = Record<string, unknown>;

function setupDatabase() {
  const tables: Record<string, Row[]> = {
    clients: [
      { id: clientId, company_id: companyId, name: originalName, document: "preserved" },
      { id: "other-client", company_id: "other-company", name: originalName },
    ],
    production_contracts: [{
      id: contractId,
      company_id: companyId,
      client_id: clientId,
      work_name: "AMIR RACHED ABBOUD",
      full_address: "ALAMEDA DOURADINHA",
      city: "ANAPOLIS",
      state: "GO",
      active: true,
    }],
    audit_logs: [],
  };
  const database = { tables, rejectClientUpdate: false, clientWrites: 0 };

  // Exercise the real Supabase query serialization against an in-memory HTTP response.
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1)!;
    const rows = tables[table];
    if (!rows) throw new Error(`Unexpected table: ${table}`);
    let selected = rows.filter((row) => Array.from(url.searchParams).every(([key, value]) => {
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value.startsWith("ilike.")) {
        return String(row[key]).toLowerCase() === value.slice(6).toLowerCase();
      }
      return true;
    }));

    const method = init?.method ?? "GET";
    if (method === "PATCH") {
      if (table === "clients") {
        database.clientWrites += 1;
        if (database.rejectClientUpdate) {
          return Response.json({ code: "42501", message: "permission denied for table clients" }, { status: 403 });
        }
      }
      const values = JSON.parse(String(init?.body)) as Row;
      selected.forEach((row) => Object.assign(row, values));
    } else if (method === "POST") {
      const values = { id: `${table}-${rows.length + 1}`, ...JSON.parse(String(init?.body)) } as Row;
      rows.push(values);
      selected = [values];
    }

    const columns = url.searchParams.get("select");
    const data = selected.map((row) => columns && columns !== "*"
      ? Object.fromEntries(columns.split(",").map((column) => [column.trim(), row[column.trim()]]))
      : { ...row });
    const single = new Headers(init?.headers).get("Accept")?.includes("application/vnd.pgrst.object+json");
    if (single && data.length !== 1) {
      return Response.json({ code: "PGRST116", message: "Unexpected row count" }, { status: 406 });
    }
    return Response.json(single ? data[0] : data);
  });

  const admin = createClient("https://test.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  });
  vi.mocked(requirePermissionAccess).mockResolvedValue({
    admin,
    authUserId: userId,
    email: null,
    profile: { id: "profile-id", company_id: companyId, is_master: false },
  } as Awaited<ReturnType<typeof requirePermissionAccess>>);
  return { tables, database, fetchMock };
}

function correctionForm(name: string) {
  const formData = new FormData();
  Object.entries({
    id: contractId,
    client_name: name,
    work_name: "AMIR RACHED ABBOUD",
    full_address: "ALAMEDA DOURADINHA",
    city: "ANAPOLIS",
    state: "GO",
    adjustment_reason: "Padronizar o nome do cliente.",
  }).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("updateContractWorkDataAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["AMIR RACHED ABBOUD", "amir rached abboud"])("persists a case-only correction: %s", async (name) => {
    const { tables } = setupDatabase();
    const result = await updateContractWorkDataAction(initialState, correctionForm(name));

    expect(result.ok).toBe(true);
    expect(tables.clients[0]).toMatchObject({ id: clientId, name, document: "preserved" });
    expect(tables.production_contracts[0].client_id).toBe(clientId);
    expect(tables.clients).toHaveLength(2);
    expect(tables.clients[1].name).toBe(originalName);
    expect(tables.audit_logs[0]).toMatchObject({
      entity_id: contractId,
      user_id: userId,
      before_data: { client_name: originalName },
      after_data: { client_name: name },
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/tecnico/contratos/${contractId}`);
  });

  it("does not rewrite the client when only work data changes", async () => {
    const { database, tables } = setupDatabase();
    const formData = correctionForm(originalName);
    formData.set("city", "GOIANIA");
    const result = await updateContractWorkDataAction(initialState, formData);

    expect(result.ok).toBe(true);
    expect(database.clientWrites).toBe(0);
    expect(tables.production_contracts[0].city).toBe("GOIANIA");
  });

  it("keeps client reassignment working and saves the requested casing", async () => {
    const { tables } = setupDatabase();
    tables.clients.push({ id: "target-client", company_id: companyId, name: "Outro Cliente" });
    const result = await updateContractWorkDataAction(initialState, correctionForm("OUTRO CLIENTE"));

    expect(result.ok).toBe(true);
    expect(tables.clients[0].name).toBe(originalName);
    expect(tables.clients[2].name).toBe("OUTRO CLIENTE");
    expect(tables.clients).toHaveLength(3);
    expect(tables.production_contracts[0].client_id).toBe("target-client");
  });

  it("keeps corrections to a new client name working", async () => {
    const { tables } = setupDatabase();
    const result = await updateContractWorkDataAction(initialState, correctionForm("NOVO CLIENTE"));

    expect(result.ok).toBe(true);
    expect(tables.clients[0].name).toBe(originalName);
    expect(tables.clients[2].name).toBe("NOVO CLIENTE");
    expect(tables.production_contracts[0].client_id).toBe(tables.clients[2].id);
  });

  it("reports a failed client update without recording a successful correction", async () => {
    const { database, tables } = setupDatabase();
    database.rejectClientUpdate = true;
    const result = await updateContractWorkDataAction(initialState, correctionForm("AMIR RACHED ABBOUD"));

    expect(result).toEqual({ ok: false, message: "Seu usuário não tem permissão para executar esta operação." });
    expect(tables.clients[0].name).toBe(originalName);
    expect(tables.audit_logs).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("requires correction permission before accessing any records", async () => {
    const { fetchMock } = setupDatabase();
    vi.mocked(requirePermissionAccess).mockRejectedValueOnce(new Error("Sem permissão para corrigir dados da obra."));
    const result = await updateContractWorkDataAction(initialState, correctionForm("AMIR RACHED ABBOUD"));

    expect(result.ok).toBe(false);
    expect(requirePermissionAccess).toHaveBeenCalledWith("technical.contracts.correct_work_data", expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
