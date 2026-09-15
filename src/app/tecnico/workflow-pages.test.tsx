import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import DashboardPage from "./page";
import ContractPage from "./contratos/[id]/page";
import ContractsPage from "./contratos/page";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalContractDetailData, getTechnicalContractsData, getTechnicalDashboardData } from "@/lib/technical-data";
import type { TechnicalSnapshot } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-access", () => ({
  getCurrentPermissionFlags: vi.fn().mockResolvedValue({ isMaster: true, permissions: {} }),
  requireAuthenticatedProfile: vi.fn().mockResolvedValue({ profile: { id: "me" } }),
}));
vi.mock("@/lib/technical-data", async (original) => ({
  ...await original<typeof import("@/lib/technical-data")>(),
  getTechnicalDashboardData: vi.fn(), getTechnicalContractDetailData: vi.fn(), getTechnicalContractsData: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("Not found"); },
  redirect: () => { throw new Error("Unexpected redirect"); },
  usePathname: () => "/tecnico/contratos/contract",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

let snapshot: TechnicalSnapshot;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.mocked(getCurrentPermissionFlags).mockResolvedValue({ isMaster: true, permissions: {} });
  snapshot = {
    source: "empty", clients: [{ id: "client", name: "Cliente de teste" }],
    profiles: [{ id: "me", name: "Participante de teste", title: "Técnico" }],
    contracts: [{ id: "contract", client_id: "client", active: true, contract_number: "26-0001", work_name: "Obra de teste", full_address: "Rua de teste, 100" }],
    technicalContracts: [{ contract_id: "contract", commercial_folder_received: false, technical_status: "aguardando_reuniao" }],
    pieces: [], meetings: [], stageValidations: [], stageValidationParticipants: [], actions: [], visits: [], visitPieces: [],
    releases: [], releasePieces: [], releaseParticipants: [], corrections: [], prodBatches: [], prodBatchPieces: [],
    prodDocuments: [], deliveries: [], doubts: [], notifications: [], auditLogs: [],
  } as unknown as TechnicalSnapshot;
  vi.mocked(getTechnicalDashboardData).mockResolvedValue(snapshot);
  vi.mocked(getTechnicalContractDetailData).mockResolvedValue(snapshot);
  vi.mocked(getTechnicalContractsData).mockResolvedValue(snapshot);
});

describe("contracts list as the primary screen", () => {
  it("renders the list and launch buttons without either creation form", async () => {
    const html = renderToStaticMarkup(await ContractsPage());
    expect(html).toContain("Importar PDF");
    expect(html).toContain("Novo contrato");
    expect(html).toContain("Buscar contratos");
    expect(html).toContain("Situação do contrato");
    expect(html).toContain("26-0001");
    expect(html).not.toContain("Salvar contrato");
    expect(html).not.toContain("Conferir extração");
    expect(html).not.toContain("<dialog");
  });
  it.each([
    [false, false], [true, false], [false, true],
  ])("respects import=%s and manual=%s permissions", async (canImport, canManualCreate) => {
    vi.mocked(getCurrentPermissionFlags).mockResolvedValue({ isMaster: false, permissions: {
      "technical.contracts.view": true,
      "technical.contracts.import_pdf": canImport,
      "technical.contracts.manual_create": canManualCreate,
    } });
    const html = renderToStaticMarkup(await ContractsPage());
    expect(html.includes("Importar PDF")).toBe(canImport);
    expect(html.includes("Novo contrato")).toBe(canManualCreate);
    expect(html).toContain("26-0001");
  });
});

async function contractHtml() {
  return renderToStaticMarkup(await ContractPage({ params: Promise.resolve({ id: "contract" }) }));
}
async function preview(name: string, html: string) {
  const directory = process.env.WORKFLOW_PREVIEW_DIR;
  if (directory) await writeFile(join(directory, name + ".html"), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verificação local</title><link rel="stylesheet" href="/app.css"></head><body><main style="max-width:1440px;margin:auto;padding:24px">${html}</main></body></html>`);
}

describe("meeting-first workflow pages", () => {
  it("shows the dashboard counters in the new order without counting a new contract as waiting for a folder", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html.indexOf("Aguardando reunião")).toBeLessThan(html.indexOf("Aguardando pasta"));
    expect(html).toMatch(/Aguardando reunião<[^>]+>[\s\S]*?>1<\/p>/);
    expect(html).toMatch(/Aguardando pasta<[^>]+>[\s\S]*?>0<\/p>/);
    await preview("dashboard", html);
  });
  it("consolidates actions and corrections into a single dashboard counter", async () => {
    snapshot.actions = [{
      id: "action-open", contract_id: "contract", title: "Ação aberta", description: "Descrição",
      responsible_profile_id: "me", priority: "normal", blocking: false, status: "aberta", deleted_at: null,
    }] as unknown as TechnicalSnapshot["actions"];
    snapshot.corrections = [{
      id: "correction-open", contract_id: "contract", type: "Correção aberta", description: "Descrição",
      responsible_profile_id: "me", priority: "normal", blocking: false, critical: false,
      status: "aberta", deleted_at: null,
    }] as unknown as TechnicalSnapshot["corrections"];

    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toMatch(/Ações abertas<[^>]+>[\s\S]*?>2<\/p>/);
    expect(html).not.toContain("Correções abertas");
  });
  it("shows visit time and work name in the upcoming agenda", async () => {
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + 1);
    snapshot.visits = [{
      id: "visit-dashboard",
      contract_id: "contract",
      scheduled_date: scheduled.toISOString().slice(0, 10),
      scheduled_time: "14:30:00",
      visit_type: "Medição",
      technicians: ["Warlley"],
      status: "agendada",
    }] as unknown as TechnicalSnapshot["visits"];

    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("14:30 · Medição");
    expect(html).toContain("26-0001 · Obra de teste");
    expect(html).toContain("Técnico:");
    expect(html).toContain("Warlley");
    await preview("dashboard-agenda", html);
  });
  it("puts the meeting before the folder in the tabs and collapsed stages, and only offers the meeting form", async () => {
    const html = await contractHtml();
    expect(html.indexOf('href="#reuniao"')).toBeLessThan(html.indexOf('href="#entrada"'));
    expect(html.indexOf('id="reuniao"')).toBeLessThan(html.indexOf('id="entrada"'));
    expect(html).toContain("Registrar reunião");
    expect(html).toContain("Entrega da pasta");
    expect(html).not.toContain("Entrada comercial");
    expect(html).toContain("Salvar responsáveis");
    expect(html).toContain("Participante de teste · Técnico");
    expect(html).toContain("Ações abertas");
    expect(html).not.toContain("Correções abertas");
    expect(html).not.toContain("Registrar pasta");
    expect(html).not.toContain("Agendar visita");
    expect(html).not.toMatch(/<details[^>]*\sopen[\s=>]/);
    await preview("contract", html);
  });
  it("only offers the folder once all meeting participants have signed", async () => {
    snapshot.technicalContracts[0].technical_status = "aguardando_pasta";
    snapshot.meetings = [{ id: "m", contract_id: "contract", status: "concluida", participants: ["Participante"], meeting_date: "2026-09-14" }] as TechnicalSnapshot["meetings"];
    snapshot.stageValidations = [{ stage: "reuniao_ata", validation_required: true }] as TechnicalSnapshot["stageValidations"];
    snapshot.stageValidationParticipants = [{ stage: "reuniao_ata", profile_id: "me", signed_at: null }] as TechnicalSnapshot["stageValidationParticipants"];
    const pending = await contractHtml();
    expect(pending).not.toContain("Registrar pasta");
    expect(pending).not.toContain("Agendar visita");
    await preview("pending-signature", pending);
    snapshot.stageValidationParticipants[0].signed_at = "2026-09-14T10:00:00Z";
    const ready = await contractHtml();
    expect(ready).toContain("Registrar pasta");
    expect(ready).not.toContain("Registrar reunião");
    expect(ready).not.toContain("Agendar visita");
    await preview("folder-ready", ready);
  });
  it("only offers visits when the meeting and the delivered folder are both signed", async () => {
    snapshot.technicalContracts[0].technical_status = "em_acompanhamento";
    snapshot.technicalContracts[0].commercial_folder_received = true;
    snapshot.meetings = [{ id: "m", contract_id: "contract", status: "concluida", participants: [], meeting_date: "2026-09-14" }] as unknown as TechnicalSnapshot["meetings"];
    snapshot.stageValidations = [{ stage: "entrada_comercial", validation_required: true }] as TechnicalSnapshot["stageValidations"];
    snapshot.stageValidationParticipants = [{ stage: "entrada_comercial", profile_id: "me", signed_at: null }] as TechnicalSnapshot["stageValidationParticipants"];
    expect(await contractHtml()).not.toContain("Agendar visita");
    snapshot.stageValidationParticipants[0].signed_at = "2026-09-14T10:00:00Z";
    expect(await contractHtml()).toContain("Agendar visita");
  });

  it("shows contract pieces in work data and blocks only the piece with an open structural action", async () => {
    snapshot.technicalContracts[0].technical_status = "em_acompanhamento";
    snapshot.technicalContracts[0].commercial_folder_received = true;
    snapshot.meetings = [{ id: "m", contract_id: "contract", status: "concluida", participants: [], meeting_date: "2026-09-14" }] as unknown as TechnicalSnapshot["meetings"];
    snapshot.pieces = [{
      id: "piece-1", contract_id: "contract", code: "P1", environment: "Sala de estar",
      piece_type: "Porta de correr", sale_width_mm: 2400, sale_height_mm: 2200,
      measured_width_mm: 2380, measured_height_mm: 2190, status: "medida", quantity: 1,
      cem_registered: false, cem_checked: false, released_at: null, deleted_at: null,
    }] as unknown as TechnicalSnapshot["pieces"];
    snapshot.actions = [{
      id: "action-1", contract_id: "contract", piece_id: "piece-1", action_type: "alteracao_estrutural",
      title: "Alteração estrutural · P1", description: "Mudança no sistema de abertura", priority: "alta",
      financial_impact: "a_avaliar", financial_amount: null, blocking: true, status: "aberta", deleted_at: null,
    }] as unknown as TechnicalSnapshot["actions"];

    const html = await contractHtml();
    expect(html).toContain("Peças do contrato");
    expect(html).toContain("Cadastro-base recebido do Comercial");
    expect(html).toContain("Ambiente conferido em obra");
    expect(html).toContain("Registrar alteração estrutural");
    expect(html).toContain("Liberação bloqueada até a conclusão da ação estrutural");
    expect(html).toMatch(/<input[^>]+disabled[^>]+name="piece_ids"/);
    await preview(
      "contract-pieces",
      html
        .replace('id="dados-obra"', 'id="dados-obra" open')
        .replace('id="pecas"', 'id="pecas" open'),
    );
  });

  it("shows a compact description and responsible for the next action", async () => {
    snapshot.actions = [{
      id: "action-summary", contract_id: "contract", title: "P1",
      description: "Confirmar o acabamento e a divisão da peça com o cliente.",
      responsible_profile_id: "me", due_date: "2026-09-20", priority: "normal",
      blocking: true, status: "aberta", deleted_at: null,
    }] as unknown as TechnicalSnapshot["actions"];

    const html = await contractHtml();
    expect(html).toContain("Confirmar o acabamento e a divisão da peça com o cliente.");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("Responsável:");
    expect(html).toContain("Participante de teste");
  });
});
