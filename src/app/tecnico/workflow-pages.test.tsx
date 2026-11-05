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
    expect(html).toContain("Adicionar obra");
    expect(html).toContain("/tecnico/contratos/adicionar");
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
    expect(html.includes("Adicionar obra")).toBe(canImport || canManualCreate);
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
  it("shows the released pieces separately from the editable pending balance in the work detail", async () => {
    snapshot.technicalContracts[0].contractual_deadline_value = 4;
    snapshot.technicalContracts[0].contractual_deadline_unit = "dias_corridos";
    snapshot.pieces = [
      {id:"p01",contract_id:"contract",code:"P01",environment:"Sala",piece_type:"Porta de correr",quantity:1,status:"liberada",released_at:"2026-11-03T12:00:00Z",forecast_date:"2026-11-01"},
      {id:"j01",contract_id:"contract",code:"J01",environment:"Cozinha",piece_type:"Janela maxim-ar",quantity:2,status:"medida",forecast_date:"2099-11-10"},
    ] as TechnicalSnapshot["pieces"];
    const html = (await contractHtml()).split('id="visao-geral"')[1].split("</section>")[0];
    expect(html).toContain("3 contratadas");
    const [pending,released] = html.split("<tbody")[1].split("</tr>");
    expect(pending).toContain("Selecionar J01");
    expect(pending).toContain("Cozinha");
    expect(pending).toContain("Prevista");
    expect(pending).toContain("10/11/2099");
    expect(pending).toContain("14/11/2099");
    expect(html).toContain("Ordenar por Ambiente em ordem crescente");
    expect(released).toContain("P01");
    expect(released).toContain("Liberada");
    expect(released).not.toContain("Selecionar P01");
    expect(released).toContain("07/11/2026");
    expect(released).not.toContain("Guardar previsão");
  });
  it("shows the dashboard counters in the new order without counting a new contract as waiting for a folder", async () => {
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html.indexOf("Aguardando reunião")).toBeLessThan(html.indexOf("Aguardando pasta"));
    expect(html).toMatch(/Aguardando reunião<[^>]+>[\s\S]*?>1<\/p>/);
    expect(html).toMatch(/Aguardando pasta<[^>]+>[\s\S]*?>0<\/p>/);
    await preview("dashboard", html);
  });
  it("counts pending quantities consistently across all active piece statuses", async () => {
    snapshot.pieces = [
      {contract_id:"contract", status:"cadastrada", quantity:10},
      {contract_id:"contract", status:"medida", quantity:3},
      {contract_id:"contract", status:"liberada", quantity:2},
      {contract_id:"contract", status:"cancelada", quantity:90},
      {contract_id:"contract", status:"medida", quantity:50, deleted_at:"2026-11-01"},
    ] as TechnicalSnapshot["pieces"];
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).toContain("13 peças a liberar");
    expect(html).toMatch(/Peças aguardando liberação<[^>]+>[\s\S]*?>13<\/p>/);
    expect(html).toContain("de 15 peças liberadas");
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

    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).toMatch(/Ações abertas<[^>]+>[\s\S]*?>2<\/p>/);
    expect(html).not.toContain("Correções abertas");
  });
  it("keeps a cancelled visit from hiding an unscheduled work with remaining pieces", async () => {
    snapshot.technicalContracts[0].commercial_folder_received = true;
    snapshot.pieces = [{ contract_id: "contract", status: "medida", deleted_at: null }] as TechnicalSnapshot["pieces"];
    snapshot.visits = [{ contract_id: "contract", status: "cancelada", scheduled_date: "2099-01-01" }] as TechnicalSnapshot["visits"];
    const renderQueue = async () => renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({ fila: "agendar" }) }));
    expect(await renderQueue()).toContain("Sem medição agendada · 1 peça(s) a liberar");
    snapshot.visits[0].status = "agendada";
    snapshot.visits[0].visit_type = "Orientação";
    expect(await renderQueue()).toContain("Agendar medição →");
    snapshot.visits[0].visit_type = "Orientação e Medição";
    expect(await renderQueue()).toContain("Nenhuma obra nesta fila.");
  });
  it("shows the assigned person and actual deadline for the next open action", async () => {
    snapshot.actions = [{contract_id: "contract", title: "Confirmar acabamento", responsible_profile_id: "me", status: "aberta", due_date: "2026-11-06"}] as TechnicalSnapshot["actions"];
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).toContain("Confirmar acabamento");
    expect(html).toContain("Responsável: Participante de teste");
    expect(html).toContain("Prazo: 06/11/2026");
  });
  it("shows partial works only in the remaining balance queue even with no appointment", async () => {
    snapshot.technicalContracts[0].commercial_folder_received = true;
    snapshot.pieces = [
      {id:"released",contract_id:"contract",status:"liberada",quantity:2},
      {id:"next",contract_id:"contract",status:"medida",quantity:3,forecast_date:"2099-01-02"},
      {id:"missing",contract_id:"contract",status:"medida",quantity:1},
    ] as TechnicalSnapshot["pieces"];
    const queue = async (fila:string) => renderToStaticMarkup(await DashboardPage({searchParams:Promise.resolve({fila})}));
    expect(await queue("agendar")).toContain("Nenhuma obra nesta fila.");
    const partial = await queue("parcial");
    expect(partial).toContain("Saldo a liberar · 4 de 6 peças");
    expect(partial).toContain("02/01/2099");
    expect(partial).toContain("Sem previsão: 1 peça(s)");
    expect(partial).not.toContain("Carga do Igor");
    const granted = ["technical.visits.manage", "technical.dashboard.view", "technical.contracts.view"];
    vi.mocked(getCurrentPermissionFlags).mockImplementation(async keys => ({
      isMaster: false, permissions: Object.fromEntries(keys.map(key => [key, granted.includes(key)])),
    }));
    expect(await queue("parcial")).toContain("Informar ou alterar previsão");
    granted.shift();
    expect(await queue("parcial")).not.toContain("Informar ou alterar previsão");
  });
  it("uses the oldest eligible release and skips a holiday for the PROD deadline", async () => {
    snapshot.technicalContracts[0].company_id = "company";
    snapshot.dashboardHolidays = [{company_id: "company", holiday_date: "2026-11-02"}];
    snapshot.pieces = [
      {contract_id: "contract", status: "liberada", released_at: "2026-10-28"},
      {contract_id: "contract", status: "liberada", released_at: "2026-10-30"},
    ] as TechnicalSnapshot["pieces"];
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({ fila: "prod" }) }));
    expect(html).toContain("Prazo: 05/11/2026");
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

    const html = renderToStaticMarkup(await DashboardPage({}));
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
    expect(html).toContain("Abrir reunião de alinhamento");
    expect(html).toContain("/tecnico/contratos/contract/reuniao");
    expect(html).not.toContain("Ação bloqueante inicial");
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
    expect(html).toContain("Ver peça");
    expect(html).toContain("Bloqueada");
    expect(html).not.toContain("Incluir P1 no lote");
    expect(html).toContain("Configurar assinaturas dos novos lotes");
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
