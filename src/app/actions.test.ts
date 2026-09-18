import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requirePermissionAccess } from "@/lib/server-access";
import { createCorrectionAction, createMeetingAction, createPieceStructuralChangeAction, createReleaseBatchAction, receiveCommercialFolderAction, reopenContractStageAction, signStageValidationAction, splitPieceAction, updateContractResponsiblesAction, updateContractWorkDataAction, updatePieceMeasurementAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server-access", () => ({
  requirePermissionAccess: vi.fn(),
  hasActiveMasterRole: vi.fn().mockResolvedValue(false),
}));

const companyId = "00000000-0000-4000-8000-000000000001";
const contractId = "00000000-0000-4000-8000-000000000002";
const clientId = "00000000-0000-4000-8000-000000000003";
const userId = "00000000-0000-4000-8000-000000000004";
const managerId = "00000000-0000-4000-8000-000000000005";
const followupId = "00000000-0000-4000-8000-000000000006";
const pieceId = "00000000-0000-4000-8000-000000000007";
const originalName = "Amir Rached Abboud";
const initialState = { ok: false, message: "" };

type Row = Record<string, unknown>;

function setupDatabase() {
  const tables: Record<string, Row[]> = {
    clients: [
      { id: clientId, company_id: companyId, name: originalName, document: "preserved" },
      { id: "other-client", company_id: "other-company", name: originalName },
    ],
    profiles: [
      { id: managerId, company_id: companyId, name: "Técnica Responsável", status: "active" },
      { id: followupId, company_id: companyId, name: "Responsável pelo Acompanhamento", status: "active" },
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
    technical_corrections: [],
    technical_contract_pieces: [],
    technical_releases: [],
    technical_release_pieces: [],
    technical_release_participants: [],
    technical_prod_batches: [],
    technical_contracts: [{
      id: "technical",
      company_id: companyId,
      contract_id: contractId,
      technical_manager_profile_id: null,
      followup_profile_id: null,
      commercial_folder_received: false,
      technical_status: "aguardando_reuniao",
    }],
    technical_closing_meetings: [],
    technical_stage_validations: [],
    technical_stage_validation_participants: [],
    technical_actions: [],
    platform_notifications: [],
    permissions: [
      { id: "permission-contracts-view", key: "technical.contracts.view" },
      { id: "permission-measurements", key: "technical.measurements.manage" },
      { id: "permission-release", key: "technical.pieces.release" },
    ],
    roles: [
      { id: "role-technical", company_id: companyId, active: true },
    ],
    user_roles: [
      { id: "user-role-technical", company_id: companyId, profile_id: "profile-id", role_id: "role-technical" },
    ],
    role_permissions: [
      { id: "grant-measurements", company_id: companyId, role_id: "role-technical", permission_id: "permission-measurements" },
    ],
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
      if (value === "is.null") return row[key] == null;
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
      const body = JSON.parse(String(init?.body)) as Row | Row[];
      const values = Array.isArray(body) ? body : [body];
      selected = values.map((value, index) => ({ id: `${table}-${rows.length + index + 1}`, ...value }));
      rows.push(...selected);
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

    expect(result.ok, result.message).toBe(true);
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

describe("updateContractResponsiblesAction", () => {
  beforeEach(() => vi.clearAllMocks());

  function responsiblesForm(fields: Record<string, string> = {}) {
    const formData = new FormData();
    Object.entries({
      contract_id: contractId,
      technical_manager_profile_id: managerId,
      followup_profile_id: followupId,
      adjustment_reason: "Definição dos responsáveis após o cadastro.",
      ...fields,
    }).forEach(([key, value]) => formData.set(key, value));
    return formData;
  }

  it("updates only the contract responsibles and records the reason in audit", async () => {
    const { tables } = setupDatabase();
    const result = await updateContractResponsiblesAction(initialState, responsiblesForm());

    expect(result).toEqual({ ok: true, message: "Responsáveis do contrato atualizados." });
    expect(tables.technical_contracts[0]).toMatchObject({
      technical_manager_profile_id: managerId,
      followup_profile_id: followupId,
      commercial_folder_received: false,
      technical_status: "aguardando_reuniao",
    });
    expect(tables.technical_actions).toHaveLength(0);
    expect(tables.technical_stage_validation_participants).toHaveLength(0);
    expect(tables.audit_logs[0]).toMatchObject({
      entity: "technical_contracts",
      entity_id: contractId,
      action: "responsibles_update",
      user_id: userId,
      before_data: { technical_manager_profile_id: null, followup_profile_id: null },
      after_data: { technical_manager_profile_id: managerId, followup_profile_id: followupId },
    });
    expect(String(tables.audit_logs[0].notes)).toContain("Definição dos responsáveis");
  });

  it("rejects a responsible who is not an active profile in the company", async () => {
    const { tables } = setupDatabase();
    const result = await updateContractResponsiblesAction(initialState, responsiblesForm({
      technical_manager_profile_id: "perfil-de-outra-empresa",
    }));

    expect(result.ok).toBe(false);
    expect(result.message).toContain("usuários ativos da empresa");
    expect(tables.technical_contracts[0].technical_manager_profile_id).toBeNull();
    expect(tables.audit_logs).toHaveLength(0);
  });

  it("does not record an audit entry when the responsibles have not changed", async () => {
    const { tables } = setupDatabase();
    tables.technical_contracts[0].technical_manager_profile_id = managerId;
    tables.technical_contracts[0].followup_profile_id = followupId;
    const result = await updateContractResponsiblesAction(initialState, responsiblesForm());

    expect(result).toEqual({ ok: false, message: "Altere ao menos um responsável antes de salvar." });
    expect(tables.audit_logs).toHaveLength(0);
  });

  it("requires contract edit permission before accessing records", async () => {
    const { fetchMock } = setupDatabase();
    vi.mocked(requirePermissionAccess).mockRejectedValueOnce(new Error("Sem permissão para alterar o contrato."));
    const result = await updateContractResponsiblesAction(initialState, responsiblesForm());

    expect(result.ok).toBe(false);
    expect(requirePermissionAccess).toHaveBeenCalledWith("technical.contracts.edit", expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("meeting before commercial folder", () => {
  beforeEach(() => vi.clearAllMocks());

  function form(fields: Record<string, string> = {}) {
    const data = new FormData();
    Object.entries({ contract_id: contractId, meeting_date: "2026-09-14", participants: "Pessoa", folder_received_at: "2026-09-14T10:00", folder_delivered_by: "Comercial", ...fields }).forEach(([key, value]) => data.set(key, value));
    return data;
  }
  function validation(tables: Record<string, Row[]>, stage: string, signedAt: string | null = null) {
    tables.technical_stage_validations.push({ id: stage, company_id: companyId, contract_id: contractId, stage, validation_required: true });
    tables.technical_stage_validation_participants.push({ id: stage, company_id: companyId, contract_id: contractId, stage, profile_id: "profile-id", signed_at: signedAt, signed_by_auth_user_id: signedAt ? userId : null });
  }

  it("registers a meeting without a folder, then accepts the folder", async () => {
    const { tables } = setupDatabase();
    expect((await createMeetingAction(initialState, form())).ok).toBe(true);
    expect(tables.technical_contracts[0]).toMatchObject({ technical_status: "aguardando_pasta", commercial_folder_received: false });
    expect((await receiveCommercialFolderAction(initialState, form())).ok).toBe(true);
    expect(tables.technical_contracts[0]).toMatchObject({ technical_status: "em_acompanhamento", commercial_folder_received: true });
  });
  it("rejects a folder before a meeting even when the stored status is stale", async () => {
    const { tables } = setupDatabase();
    tables.technical_contracts[0].technical_status = "aguardando_pasta";
    const result = await receiveCommercialFolderAction(initialState, form());
    expect(result.ok).toBe(false);
    expect(result.message).toContain("reunião");
    expect(tables.technical_contracts[0].commercial_folder_received).toBe(false);
  });
  it("requires every meeting signature before the folder, and does not accept stale signatures after reopening", async () => {
    const { tables } = setupDatabase();
    validation(tables, "reuniao_ata");
    expect((await createMeetingAction(initialState, form())).ok).toBe(true);
    expect((await receiveCommercialFolderAction(initialState, form())).ok).toBe(false);
    expect((await signStageValidationAction(initialState, form({ stage: "reuniao_ata" }))).ok).toBe(true);
    expect((await receiveCommercialFolderAction(initialState, form())).ok).toBe(true);
    expect((await reopenContractStageAction(initialState, form({ stage: "reuniao_ata", reason: "Corrigir a ata" }))).ok).toBe(true);
    expect(tables.technical_stage_validation_participants[0]).toMatchObject({ signed_at: null, signed_by_auth_user_id: null });
    expect(tables.technical_contracts[0].commercial_folder_received).toBe(true);
    expect(tables.technical_closing_meetings[0].status).toBe("cancelada");
    expect((await createMeetingAction(initialState, form())).ok).toBe(true);
    expect(tables.technical_contracts[0].technical_status).toBe("em_acompanhamento");
  });
  it("preserves a legacy delivered folder when its missing meeting is registered", async () => {
    const { tables } = setupDatabase();
    tables.technical_contracts[0].commercial_folder_received = true;
    tables.technical_contracts[0].folder_delivered_by = "Comercial original";
    validation(tables, "entrada_comercial");
    expect((await createMeetingAction(initialState, form())).ok).toBe(true);
    expect(tables.technical_contracts[0]).toMatchObject({ technical_status: "em_acompanhamento", commercial_folder_received: true, folder_delivered_by: "Comercial original" });
  });
  it("reopens only the folder without cancelling the earlier meeting or its signatures", async () => {
    const { tables } = setupDatabase();
    await createMeetingAction(initialState, form());
    await receiveCommercialFolderAction(initialState, form());
    validation(tables, "reuniao_ata", "2026-09-14T10:00:00Z");
    validation(tables, "entrada_comercial", "2026-09-14T11:00:00Z");
    const result = await reopenContractStageAction(initialState, form({ stage: "entrada_comercial", reason: "Corrigir entrega" }));
    expect(result.ok).toBe(true);
    expect(tables.technical_closing_meetings[0].status).toBe("concluida");
    expect(tables.technical_contracts[0]).toMatchObject({ technical_status: "aguardando_pasta", commercial_folder_received: false });
    expect(tables.technical_stage_validation_participants[0].signed_at).toBeTruthy();
    expect(tables.technical_stage_validation_participants[1].signed_at).toBeNull();
    expect(tables.audit_logs.at(-1)?.notes).toContain("Corrigir entrega");
  });
  it("blocks a folder signature until the meeting is complete and signed", async () => {
    const { tables } = setupDatabase();
    tables.technical_contracts[0].commercial_folder_received = true;
    validation(tables, "entrada_comercial");
    validation(tables, "reuniao_ata");
    expect((await signStageValidationAction(initialState, form({ stage: "entrada_comercial" }))).ok).toBe(false);
    await createMeetingAction(initialState, form());
    expect((await signStageValidationAction(initialState, form({ stage: "entrada_comercial" }))).ok).toBe(false);
    await signStageValidationAction(initialState, form({ stage: "reuniao_ata" }));
    expect((await signStageValidationAction(initialState, form({ stage: "entrada_comercial" }))).ok).toBe(true);
  });
  it("can resume after both stages have been reopened", async () => {
    const { tables } = setupDatabase();
    await createMeetingAction(initialState, form());
    await receiveCommercialFolderAction(initialState, form());
    await reopenContractStageAction(initialState, form({ stage: "reuniao_ata", reason: "Corrigir reunião" }));
    await reopenContractStageAction(initialState, form({ stage: "entrada_comercial", reason: "Corrigir pasta" }));
    expect(tables.technical_contracts[0].technical_status).toBe("aguardando_reuniao");
    expect((await createMeetingAction(initialState, form())).ok).toBe(true);
    expect((await receiveCommercialFolderAction(initialState, form())).ok).toBe(true);
  });
  it("does not allow duplicate completed stages", async () => {
    const { tables } = setupDatabase();
    await createMeetingAction(initialState, form());
    expect((await createMeetingAction(initialState, form())).ok).toBe(false);
    await receiveCommercialFolderAction(initialState, form());
    expect((await receiveCommercialFolderAction(initialState, form())).ok).toBe(false);
    expect(tables.technical_closing_meetings).toHaveLength(1);
  });
  it("keeps the permission checks and requires a reason for reopening", async () => {
    const { fetchMock } = setupDatabase();
    vi.mocked(requirePermissionAccess).mockRejectedValueOnce(new Error("Sem permissão."));
    expect((await createMeetingAction(initialState, form())).ok).toBe(false);
    expect(requirePermissionAccess).toHaveBeenCalledWith("technical.meetings.manage", undefined);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await reopenContractStageAction(initialState, form({ stage: "reuniao_ata", reason: "" }))).ok).toBe(false);
    expect(requirePermissionAccess).toHaveBeenLastCalledWith("technical.contracts.edit", expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("never reads or updates a contract from another company", async () => {
    const { tables } = setupDatabase();
    tables.technical_contracts[0].company_id = "another-company";
    expect((await createMeetingAction(initialState, form())).ok).toBe(false);
    expect((await receiveCommercialFolderAction(initialState, form())).ok).toBe(false);
    expect(tables.technical_closing_meetings).toEqual([]);
  });
});

describe("createCorrectionAction in the actions center", () => {
  beforeEach(() => vi.clearAllMocks());

  function form() {
    const data = new FormData();
    Object.entries({ contract_id: contractId, type: "Conferir medida", description: "Conferir largura", piece_id: "piece-1", prod_batch_id: "prod-1" }).forEach(([key, value]) => data.set(key, value));
    return data;
  }

  it("saves a correction with unchecked flags and valid piece and PROD links", async () => {
    const { tables } = setupDatabase();
    tables.technical_contract_pieces.push({ id: "piece-1", company_id: companyId, contract_id: contractId, deleted_at: null });
    tables.technical_prod_batches.push({ id: "prod-1", company_id: companyId, contract_id: contractId, deleted_at: null });
    const result = await createCorrectionAction(initialState, form());
    expect(result.ok).toBe(true);
    expect(tables.technical_corrections[0]).toMatchObject({ contract_id: contractId, piece_id: "piece-1", prod_batch_id: "prod-1", blocking: false, critical: false, status: "aberta" });
    expect(tables.technical_contract_pieces[0].status).toBe("em_correcao");
    expect(requirePermissionAccess).toHaveBeenCalledWith("technical.corrections.manage", undefined);
  });

  it.each(["technical_contract_pieces", "technical_prod_batches"])("rejects a cross-contract link in %s", async (table) => {
    const { tables } = setupDatabase();
    tables.technical_contract_pieces.push({ id: "piece-1", company_id: companyId, contract_id: contractId, deleted_at: null });
    tables.technical_prod_batches.push({ id: "prod-1", company_id: companyId, contract_id: contractId, deleted_at: null });
    tables[table][0].contract_id = "another-contract";
    const result = await createCorrectionAction(initialState, form());
    expect(result.ok).toBe(false);
    expect(result.message).toContain("não pertence ao contrato selecionado");
    expect(tables.technical_corrections).toHaveLength(0);
  });
});

describe("piece measurement and structural changes", () => {
  beforeEach(() => vi.clearAllMocks());

  function prepareMeasuredPiece() {
    const state = setupDatabase();
    state.tables.technical_contract_pieces.push({
      id: pieceId,
      company_id: companyId,
      contract_id: contractId,
      code: "P1",
      piece_type: "PORTA DE CORRER",
      quantity: 1,
      sale_width_mm: 2000,
      sale_height_mm: 1200,
      environment: "Sala",
      measured_width_mm: null,
      measured_height_mm: null,
      project_only: false,
      status: "aguardando_avaliacao",
      released_at: null,
      deleted_at: null,
    });
    state.tables.technical_stage_validations.push({
      id: "validation-visits",
      company_id: companyId,
      contract_id: contractId,
      stage: "visitas",
      validation_required: false,
    });
    return state;
  }

  it("updates the field environment with the measurement and records the audit trail", async () => {
    const { tables } = prepareMeasuredPiece();
    const formData = new FormData();
    formData.set("id", pieceId);
    formData.set("environment", "Varanda gourmet");
    formData.set("measured_width_mm", "2380");
    formData.set("measured_height_mm", "2190");

    const result = await updatePieceMeasurementAction(initialState, formData);

    expect(result.ok, result.message).toBe(true);
    expect(tables.technical_contract_pieces[0]).toMatchObject({
      environment: "Varanda gourmet",
      measured_width_mm: 2380,
      measured_height_mm: 2190,
      status: "medida",
    });
    expect(tables.audit_logs.at(-1)).toMatchObject({
      entity: "technical_contract_pieces",
      action: "measurement_update",
      before_data: { environment: "Sala" },
      after_data: { environment: "Varanda gourmet" },
    });
  });

  it("marks a piece as Projeto and clears existing measurements without treating it as measured", async () => {
    const { tables } = prepareMeasuredPiece();
    tables.technical_contract_pieces[0].measured_width_mm = 2380;
    tables.technical_contract_pieces[0].measured_height_mm = 2190;
    tables.technical_contract_pieces[0].status = "medida";
    const formData = new FormData();
    formData.set("id", pieceId);
    formData.set("environment", "Sala");
    formData.set("project_only", "on");

    const result = await updatePieceMeasurementAction(initialState, formData);

    expect(result.ok, result.message).toBe(true);
    expect(tables.technical_contract_pieces[0]).toMatchObject({
      project_only: true,
      measured_width_mm: null,
      measured_height_mm: null,
      status: "avaliada",
    });
    expect(tables.audit_logs.at(-1)?.after_data).toMatchObject({ project_only: true, measured_width_mm: null });
  });

  it("replaces Projeto with a real measurement when dimensions are recorded", async () => {
    const { tables } = prepareMeasuredPiece();
    tables.technical_contract_pieces[0].project_only = true;
    const formData = new FormData();
    formData.set("id", pieceId);
    formData.set("environment", "Sala");
    formData.set("measured_width_mm", "2380");
    formData.set("measured_height_mm", "2190");

    const result = await updatePieceMeasurementAction(initialState, formData);

    expect(result.ok, result.message).toBe(true);
    expect(tables.technical_contract_pieces[0]).toMatchObject({
      project_only: false,
      measured_width_mm: 2380,
      measured_height_mm: 2190,
      status: "medida",
    });
  });

  it("does not remove Projeto without both dimensions", async () => {
    const { tables } = prepareMeasuredPiece();
    tables.technical_contract_pieces[0].project_only = true;
    const formData = new FormData();
    formData.set("id", pieceId);
    formData.set("environment", "Sala");
    formData.set("measured_width_mm", "2380");

    const result = await updatePieceMeasurementAction(initialState, formData);

    expect(result.ok).toBe(false);
    expect(tables.technical_contract_pieces[0].project_only).toBe(true);
  });

  it("releases a Projeto piece in a batch without numeric measurements and keeps the batch snapshot", async () => {
    const { tables } = prepareMeasuredPiece();
    const formData = new FormData();
    formData.set("contract_id", contractId);
    formData.set("piece_ids", pieceId);
    formData.set(`project_only_${pieceId}`, "on");
    formData.set(`environment_${pieceId}`, "Sala");

    const result = await createReleaseBatchAction(initialState, formData);

    expect(result.ok, result.message).toBe(true);
    expect(tables.technical_contract_pieces[0]).toMatchObject({
      project_only: true,
      measured_width_mm: null,
      measured_height_mm: null,
      status: "liberada",
    });
    expect(tables.technical_release_pieces[0]).toMatchObject({
      piece_id: pieceId,
      project_only_at_release: true,
    });
  });

  it("splits a pending piece while preserving the total quantity", async () => {
    const { tables } = prepareMeasuredPiece();
    tables.technical_contract_pieces[0].quantity = 3;
    tables.technical_contract_pieces[0].measured_width_mm = 2380;
    tables.technical_contract_pieces[0].measured_height_mm = 2190;
    tables.technical_contract_pieces[0].status = "medida";
    const formData = new FormData();
    formData.set("id", pieceId);
    formData.set("suffix", "A");
    formData.set("quantity", "1");

    const result = await splitPieceAction(initialState, formData);

    expect(result.ok, result.message).toBe(true);
    expect(tables.technical_contract_pieces[0]).toMatchObject({
      code: "P1",
      quantity: 2,
    });
    expect(tables.technical_contract_pieces[1]).toMatchObject({
      parent_piece_id: pieceId,
      code: "P1_A",
      quantity: 1,
      measured_width_mm: 2380,
      measured_height_mm: 2190,
      status: "medida",
    });
    expect(tables.audit_logs.at(-1)).toMatchObject({
      entity: "technical_contract_pieces",
      action: "split_piece",
      after_data: {
        quantity: 2,
        split_piece_code: "P1_A",
        split_quantity: 1,
      },
    });
  });

  it("does not split a piece when the detached quantity consumes the original piece", async () => {
    const { tables } = prepareMeasuredPiece();
    tables.technical_contract_pieces[0].quantity = 2;
    const formData = new FormData();
    formData.set("id", pieceId);
    formData.set("suffix", "A");
    formData.set("quantity", "2");

    const result = await splitPieceAction(initialState, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("menor que a quantidade atual");
    expect(tables.technical_contract_pieces).toHaveLength(1);
    expect(tables.technical_contract_pieces[0].quantity).toBe(2);
  });

  it("creates a piece-linked blocking action for a structural change", async () => {
    const { tables } = prepareMeasuredPiece();
    const formData = new FormData();
    formData.set("piece_id", pieceId);
    formData.set("description", "Alterar o sistema de abertura definido no contrato.");
    formData.set("responsible_profile_id", managerId);
    formData.set("priority", "alta");
    formData.set("financial_impact", "cobranca_adicional");
    formData.set("financial_amount", "1250.50");

    const result = await createPieceStructuralChangeAction(initialState, formData);

    expect(result.ok).toBe(true);
    expect(tables.technical_actions[0]).toMatchObject({
      contract_id: contractId,
      piece_id: pieceId,
      action_type: "alteracao_estrutural",
      financial_impact: "cobranca_adicional",
      financial_amount: 1250.5,
      blocking: true,
      blocking_stage: "liberacao_peca",
      status: "aberta",
    });
    expect(tables.audit_logs.at(-1)).toMatchObject({
      entity: "technical_actions",
      action: "structural_change_create",
      after_data: { piece_id: pieceId, piece_code: "P1" },
    });
  });

  it("prevents releasing only a piece that still has an open structural action", async () => {
    const { tables } = prepareMeasuredPiece();
    tables.technical_contract_pieces[0].measured_width_mm = 2380;
    tables.technical_contract_pieces[0].measured_height_mm = 2190;
    tables.technical_actions.push({
      id: "structural-action",
      company_id: companyId,
      contract_id: contractId,
      piece_id: pieceId,
      action_type: "alteracao_estrutural",
      title: "Alteração estrutural · P1",
      status: "aberta",
      deleted_at: null,
    });
    const formData = new FormData();
    formData.set("contract_id", contractId);
    formData.set("piece_ids", pieceId);

    const result = await createReleaseBatchAction(initialState, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("resolva a alteração estrutural pendente antes da liberação");
    expect(tables.technical_contract_pieces[0].status).toBe("aguardando_avaliacao");
  });
});
