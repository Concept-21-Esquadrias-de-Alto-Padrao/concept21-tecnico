import { describe, expect, it } from "vitest";
import { buildTechnicalWorkItems, filterTechnicalWorkItems } from "./technical-work-items";
import { canAccessModule, firstAllowedAppRoute, getWorkItemPermissions, MODULE_ACCESS } from "./module-access";
import type { TechnicalAction, TechnicalCorrection } from "./types";

const action = (id: string, status: TechnicalAction["status"] = "aberta") => ({
  id, contract_id: "contract-1", title: "Acompanhar obra", description: null,
  due_date: "2020-01-01", responsible_profile_id: "person-1", priority: "normal",
  blocking: false, status, deleted_at: null,
}) as TechnicalAction;
const correction = (id: string, status: TechnicalCorrection["status"] = "aberta") => ({
  ...action(id), type: "Ajustar medida", description: "Conferir largura", status,
  piece_id: "piece-1", prod_batch_id: "prod-1", critical: false, impact: null, closed_at: null,
}) as TechnicalCorrection;

describe("unified technical actions", () => {
  it("keeps both records when their IDs match, preserving links and types", () => {
    const items = buildTechnicalWorkItems([action("same")], [correction("same")]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: "action", title: "Acompanhar obra" });
    expect(items[1]).toMatchObject({ kind: "correction", title: "Ajustar medida", piece_id: "piece-1", prod_batch_id: "prod-1", responsible_profile_id: "person-1" });
  });

  it("preserves the piece and financial context of structural actions", () => {
    const items = buildTechnicalWorkItems([{
      ...action("structural"),
      piece_id: "piece-2",
      action_type: "alteracao_estrutural",
      financial_impact: "cobranca_adicional",
      financial_amount: 850,
      blocking: true,
    }], []);

    expect(items[0]).toMatchObject({
      kind: "action",
      piece_id: "piece-2",
      action_type: "alteracao_estrutural",
      financial_impact: "cobranca_adicional",
      financial_amount: 850,
      blocking: true,
    });
  });

  it("counts validated actions as open and keeps concluded/cancelled records in history", () => {
    const items = buildTechnicalWorkItems(
      [action("a", "validada"), action("b", "concluida"), action("c", "cancelada")],
      [correction("d", "aguardando_validacao"), correction("e", "encerrada"), correction("f", "cancelada")],
    );
    expect(filterTechnicalWorkItems(items, { situation: "open" }).map((item) => item.id)).toEqual(["a", "d"]);
    expect(filterTechnicalWorkItems(items, { situation: "closed" })).toHaveLength(4);
    expect(filterTechnicalWorkItems(items, { situation: "all" })).toHaveLength(6);
    expect(filterTechnicalWorkItems(items, { attention: "overdue" })).toHaveLength(2);
  });

  it("excludes deleted records and combines type, contract and blocking filters", () => {
    const items = buildTechnicalWorkItems(
      [action("a"), { ...action("deleted"), deleted_at: "2026-01-01" }],
      [{ ...correction("b"), blocking: true }, { ...correction("c"), contract_id: "contract-2", blocking: true }, { ...correction("deleted"), deleted_at: "2026-01-01" }],
    );
    expect(items).toHaveLength(3);
    expect(filterTechnicalWorkItems(items, { kind: "correction", contractId: "contract-1", attention: "blocking" }).map((item) => item.id)).toEqual(["b"]);
  });

  it("orders critical and blocking work first without mutating the source", () => {
    const items = buildTechnicalWorkItems([action("normal")], [{ ...correction("critical"), critical: true }, { ...correction("blocking"), blocking: true }]);
    expect(filterTechnicalWorkItems(items, { situation: "open" }).map((item) => item.id)).toEqual(["critical", "blocking", "normal"]);
    expect(items[0].id).toBe("normal");
  });
});

describe("actions center permissions", () => {
  it("lets corrections-only users reach the unified area without granting access to general actions", () => {
    const access = { isMaster: false, permissions: { "technical.corrections.view": true, "technical.corrections.manage": true } };
    expect(firstAllowedAppRoute(access)).toBe("/tecnico/acoes");
    expect(canAccessModule(access, MODULE_ACCESS.actions)).toBe(true);
    expect(getWorkItemPermissions(access)).toMatchObject({ canViewActions: false, canManageActions: false, canValidateActions: false, canViewCorrections: true, canManageCorrections: true });
  });

  it("does not give action managers correction management or validation permission", () => {
    const access = { isMaster: false, permissions: { "technical.actions.view": true, "technical.actions.manage": true } };
    expect(getWorkItemPermissions(access)).toMatchObject({ canViewActions: true, canManageActions: true, canValidateActions: false, canViewCorrections: false, canManageCorrections: false });
  });

  it("preserves full administrative access", () => {
    expect(Object.values(getWorkItemPermissions({ isMaster: true, permissions: {} })).every(Boolean)).toBe(true);
  });
});
