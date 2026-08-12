import { describe, expect, it } from "vitest";
import { formatAuditLogEntry } from "./audit-log-format";
import type { TechnicalAuditLog } from "@/lib/types";

const profiles = [
  {
    id: "profile-1",
    user_id: "auth-1",
    name: "Thaís Martins",
  },
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
          work_name: "Obra antiga",
          full_address: "Rua errada",
        },
        after_data: {
          work_name: "Obra corrigida",
          full_address: "Rua certa",
        },
        notes: "Correção autorizada dos dados da obra. Motivo: leitura do PDF.",
      }),
      profiles,
    );

    expect(entry.title).toBe("O usuário Thaís Martins corrigiu os dados da obra do contrato.");
    expect(entry.details).toContain("Obra: Obra antiga -> Obra corrigida");
    expect(entry.details).toContain("Endereço: Rua errada -> Rua certa");
  });
});
