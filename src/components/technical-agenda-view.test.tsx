import * as React from "react";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TechnicalAgendaView } from "@/components/technical-agenda-view";
import type { ProductionContract, TechnicalVisit } from "@/lib/types";

vi.mock("@/app/actions", () => ({
  cancelVisitAction: vi.fn(),
  generateVisitReportFormAction: vi.fn(),
  recordVisitResultAction: vi.fn(),
}));

const contracts = [
  {
    id: "contract-1",
    contract_number: "26-0764",
    work_name: "Casa Theo",
    full_address: "Rua das Palmeiras, 120 - Goiânia - GO",
  },
  {
    id: "contract-2",
    contract_number: "26-0715",
    work_name: "Beoos Administradora",
    full_address: "Rua Ibicuí, Quadra T6 - Goiânia - GO",
  },
] satisfies Array<Pick<ProductionContract, "id" | "contract_number" | "work_name" | "full_address">>;

const visits = [
  {
    id: "visit-1",
    company_id: "company",
    contract_id: "contract-1",
    visit_type: "Medição",
    scheduled_date: "2026-09-15",
    scheduled_time: "09:00:00",
    performed_at: null,
    technicians: ["Anna Karolina Felix De Morais"],
    accompanied_by: null,
    objectives: ["Conferir vãos do pavimento térreo"],
    result_summary: null,
    report_required: true,
    report_generated_at: null,
    report_sent_at: null,
    report_snapshot: null,
    status: "agendada",
    cancel_reason: null,
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "visit-2",
    company_id: "company",
    contract_id: "contract-2",
    visit_type: "Orientação técnica",
    scheduled_date: "2026-09-15",
    scheduled_time: "14:30:00",
    performed_at: "2026-09-15T17:30:00Z",
    technicians: ["Igor Henrique Nunes de Jesus"],
    accompanied_by: "Responsável da obra",
    objectives: ["Alinhar preparação dos vãos"],
    result_summary: "Orientações registradas.",
    report_required: true,
    report_generated_at: null,
    report_sent_at: null,
    report_snapshot: null,
    status: "aguardando_relatorio",
    cancel_reason: null,
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-15T17:30:00Z",
  },
  {
    id: "visit-3",
    company_id: "company",
    contract_id: "contract-1",
    visit_type: "Conferência",
    scheduled_date: "2026-09-22",
    scheduled_time: null,
    performed_at: null,
    technicians: ["Anna Karolina Felix De Morais", "Igor Henrique Nunes de Jesus"],
    accompanied_by: null,
    objectives: ["Conferir atualizações de projeto"],
    result_summary: null,
    report_required: false,
    report_generated_at: null,
    report_sent_at: null,
    report_snapshot: null,
    status: "agendada",
    cancel_reason: null,
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
  },
] satisfies TechnicalVisit[];

async function preview(name: string, html: string) {
  const directory = process.env.WORKFLOW_PREVIEW_DIR;
  if (!directory) return;
  await writeFile(
    join(directory, `${name}.html`),
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agenda Técnica</title><link rel="stylesheet" href="/app.css"></head><body><main style="max-width:1440px;margin:auto;padding:24px">${html}</main></body></html>`,
  );
}

describe("technical agenda view", () => {
  it("renders the existing list and the calendar option", () => {
    const html = renderToStaticMarkup(
      <TechnicalAgendaView
        visits={visits}
        contracts={contracts}
        pieces={[]}
        visitPieces={[]}
        todayIso="2026-09-15"
        canManage={false}
        canCancel={false}
        canReport={false}
      />,
    );

    expect(html).toContain("Lista");
    expect(html).toContain("Calendário");
    expect(html).toContain("Todos os técnicos");
    expect(html).toContain("Todas as situações");
    expect(html).toContain("Casa Theo");
  });

  it("renders a six-week calendar and the selected day's agenda", async () => {
    const html = renderToStaticMarkup(
      <TechnicalAgendaView
        visits={visits}
        contracts={contracts}
        pieces={[]}
        visitPieces={[]}
        todayIso="2026-09-15"
        canManage={false}
        canCancel={false}
        canReport={false}
        initialViewMode="calendar"
      />,
    );

    expect(html).toContain("Setembro de 2026");
    expect(html).toContain("3 visita(s) neste mês");
    expect(html).toContain("Terça-feira, 15 de setembro de 2026");
    expect(html).toContain("2 visita(s) programada(s)");
    expect(html.match(/aria-label="Ver visitas de/g)).toHaveLength(84);
    await preview("agenda-calendar", html);
  });
});
