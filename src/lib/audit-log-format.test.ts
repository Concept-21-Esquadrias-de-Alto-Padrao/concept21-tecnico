import { describe, expect, it } from "vitest";
import { formatAuditLogEntry } from "./audit-log-format";
import type { TechnicalAuditLog } from "@/lib/types";

const profiles = [
  {
    id: "profile-1",
    user_id: "auth-1",
    name: "Thaís Martins",
  },
  { id: "manager-old", user_id: null, name: "Técnico anterior" },
  { id: "manager-new", user_id: null, name: "Técnico atual" },
  { id: "followup-new", user_id: null, name: "Acompanhamento atual" },
];

function auditLog(partial: Partial<TechnicalAuditLog>): TechnicalAuditLog {
  return {
    id: "audit-1",
    company_id: "company-1",
    entity: "technical_contract_import",
    entity_id: "contract-1",
    action: "reprocess_pdf_import",
    user_id: "auth-1",
    before_data: null,
    after_data: null,
    notes: null,
    created_at: "2026-08-10T13:53:00.000Z",
    ...partial,
  };
}

describe("formatAuditLogEntry", () => {
  it("formats PDF reprocessing as a readable user action", () => {
    const entry = formatAuditLogEntry(
      auditLog({
        after_data: {
          contractNumber: "26-0710",
          insertedPieces: 9,
          skippedDuplicatePieceCodes: ["P1", "P2"],
        },
      }),
      profiles,
    );

    expect(entry.title).toBe("O usuário Thaís Martins realizou um reprocessamento de importação de PDF.");
    expect(entry.details).toBe("Contrato 26-0710 · 9 peça(s) nova(s) importada(s) · 2 peça(s) já cadastrada(s) ignorada(s).");
  });

  it("uses a human fallback for automatic technical updates", () => {
    const entry = formatAuditLogEntry(
      auditLog({
        entity: "technical_contracts",
        action: "update",
        user_id: null,
      }),
      profiles,
    );

    expect(entry.title).toBe("O sistema atualizou os dados técnicos do contrato.");
  });

  it("formats work data corrections as a readable user action", () => {
    const entry = formatAuditLogEntry(
      auditLog({
        entity: "production_contracts",
        action: "work_data_update",
        before_data: {
          client_name: "Esmeral da Ouro Verde Agropecuária LTDA.",
          work_name: "Obra antiga",
          full_address: "Rua errada",
        },
        after_data: {
          client_name: "Esmeralda Ouro Verde Agropecuária LTDA.",
          work_name: "Obra corrigida",
          full_address: "Rua certa",
        },
        notes: "Correção autorizada dos dados da obra. Motivo: leitura do PDF.",
      }),
      profiles,
    );

    expect(entry.title).toBe("O usuário Thaís Martins corrigiu os dados da obra do contrato.");
    expect(entry.details).toContain(
      "Cliente: Esmeral da Ouro Verde Agropecuária LTDA. -> Esmeralda Ouro Verde Agropecuária LTDA.",
    );
    expect(entry.details).toContain("Obra: Obra antiga -> Obra corrigida");
    expect(entry.details).toContain("Endereço: Rua errada -> Rua certa");
  });

  it("formats administrator contract deletion as a readable user action", () => {
    const entry = formatAuditLogEntry(
      auditLog({
        entity: "technical_contracts",
        action: "admin_delete",
        notes: "Contrato técnico excluído pelo Administrador. Motivo: lançamento duplicado.",
      }),
      profiles,
    );

    expect(entry.title).toBe("O usuário Thaís Martins excluiu o contrato técnico.");
    expect(entry.details).toBe("Contrato técnico excluído pelo Administrador. Motivo: lançamento duplicado.");
  });

  it("formats responsible changes with the previous and new names", () => {
    const entry = formatAuditLogEntry(
      auditLog({
        entity: "technical_contracts",
        action: "responsibles_update",
        before_data: { technical_manager_profile_id: "manager-old", followup_profile_id: null },
        after_data: { technical_manager_profile_id: "manager-new", followup_profile_id: "followup-new" },
        notes: "Responsáveis do contrato atualizados. Motivo: definição após a visita.",
      }),
      profiles,
    );

    expect(entry.title).toBe("O usuário Thaís Martins atualizou os responsáveis do contrato.");
    expect(entry.details).toContain("Técnico: Técnico anterior -> Técnico atual");
    expect(entry.details).toContain("Acompanhamento: A definir -> Acompanhamento atual");
  });

  it("describes a measurement and an environment adaptation without technical jargon", () => {
    const entry = formatAuditLogEntry(
      auditLog({
        entity: "technical_contract_pieces",
        action: "measurement_update",
        before_data: { code: "P1", environment: "Sala", measured_width_mm: null, measured_height_mm: null },
        after_data: { code: "P1", environment: "Varanda", measured_width_mm: 1800, measured_height_mm: 2200 },
      }),
      profiles,
    );

    expect(entry.title).toBe("O usuário Thaís Martins registrou a medição da peça P1.");
    expect(entry.details).toContain("Medição: 1800 x 2200 mm");
    expect(entry.details).toContain("Ambiente: Sala -> Varanda");
  });

  it("describes a structural action and its possible financial impact", () => {
    const entry = formatAuditLogEntry(
      auditLog({
        entity: "technical_actions",
        action: "structural_change_create",
        after_data: {
          piece_code: "P2",
          financial_impact: "cobranca_adicional",
          financial_amount: 1250.5,
        },
        notes: "Troca do sistema de abertura.",
      }),
      profiles,
    );

    expect(entry.title).toBe("O usuário Thaís Martins registrou uma alteração estrutural na peça P2.");
    expect(entry.details).toContain("Possível cobrança adicional");
    expect(entry.details?.replace(/\s/g, " ")).toContain("R$ 1.250,50");
  });
});
