import { describe, expect, it } from "vitest";
import type { TechnicalContractStatus } from "./types";
import {
  addDeadlineDays,
  canAddPieceToProd,
  canAdvanceToVisit,
  canApproveProd,
  canConfirmDepartmentDelivery,
  canReleasePiece,
  calculateReleaseProgress,
  getTechnicalContractProcessOrder,
  isStageValidationSatisfied,
} from "./technical-rules";

describe("technical deadline rules", () => {
  it("adds business days ignoring weekends and holidays", () => {
    expect(
      addDeadlineDays({
        startDate: "2026-07-30",
        days: 3,
        unit: "dias_uteis",
        holidays: [{ date: "2026-07-31" }],
      }),
    ).toBe("2026-08-05");
  });

  it("adds calendar days when contract uses running days", () => {
    expect(
      addDeadlineDays({
        startDate: "2026-07-30",
        days: 3,
        unit: "dias_corridos",
      }),
    ).toBe("2026-08-02");
  });
});

describe("technical workflow gates", () => {
  it("orders dashboard activities by the internal process sequence", () => {
    const statuses: TechnicalContractStatus[] = [
      "aguardando_visita",
      "em_liberacao",
      "aguardando_reuniao",
      "aguardando_pasta",
    ];

    expect(
      statuses.sort(
        (left, right) =>
          getTechnicalContractProcessOrder(left) - getTechnicalContractProcessOrder(right),
      ),
    ).toEqual(["aguardando_pasta", "aguardando_reuniao", "aguardando_visita", "em_liberacao"]);
  });

  it("blocks first visit without commercial folder", () => {
    expect(
      canAdvanceToVisit({
        technical: { commercial_folder_received: false },
        meetings: [{ status: "concluida" }],
        actions: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("blocks first visit without closing meeting", () => {
    expect(
      canAdvanceToVisit({
        technical: { commercial_folder_received: true },
        meetings: [],
        actions: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("blocks first visit with open blocking action", () => {
    expect(
      canAdvanceToVisit({
        technical: { commercial_folder_received: true },
        meetings: [{ status: "concluida" }],
        actions: [{ blocking: true, blocking_stage: "entrada_inicial", status: "aberta" }],
      }),
    ).toMatchObject({ ok: false });
  });

  it("allows first visit when prerequisites are complete", () => {
    expect(
      canAdvanceToVisit({
        technical: { commercial_folder_received: true },
        meetings: [{ status: "concluida" }],
        actions: [{ blocking: true, blocking_stage: "entrada_inicial", status: "validada" }],
      }),
    ).toMatchObject({ ok: true });
  });

  it("treats stage validation as optional when the flag is not enabled", () => {
    expect(isStageValidationSatisfied({ validation: null, participants: [] })).toBe(true);
    expect(
      isStageValidationSatisfied({
        validation: { validation_required: false },
        participants: [{ signed_at: null }],
      }),
    ).toBe(true);
  });

  it("requires every linked participant to sign required stage validations", () => {
    expect(
      isStageValidationSatisfied({
        validation: { validation_required: true },
        participants: [],
      }),
    ).toBe(false);
    expect(
      isStageValidationSatisfied({
        validation: { validation_required: true },
        participants: [{ signed_at: "2026-08-07T10:00:00Z" }, { signed_at: null }],
      }),
    ).toBe(false);
    expect(
      isStageValidationSatisfied({
        validation: { validation_required: true },
        participants: [
          { signed_at: "2026-08-07T10:00:00Z" },
          { signed_at: "2026-08-07T10:05:00Z" },
        ],
      }),
    ).toBe(true);
  });
});

describe("piece and PROD rules", () => {
  it("blocks piece release without measurement", () => {
    expect(
      canReleasePiece({
        piece: { measured_width_mm: null, measured_height_mm: 1200, status: "avaliada" },
        corrections: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("blocks release with open blocking correction", () => {
    expect(
      canReleasePiece({
        piece: { measured_width_mm: 1000, measured_height_mm: 1200, status: "medida" },
        corrections: [{ blocking: true, status: "aberta" }],
      }),
    ).toMatchObject({ ok: false });
  });

  it("prevents a piece from entering two active PRODs", () => {
    expect(
      canAddPieceToProd({
        piece: {
          released_at: "2026-07-30T12:00:00Z",
          cem_registered: true,
          cem_checked: true,
          status: "liberada",
        },
        activeProdBatchId: "prod-1",
        corrections: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("requires CEM registration and check before PROD", () => {
    expect(
      canAddPieceToProd({
        piece: {
          released_at: "2026-07-30T12:00:00Z",
          cem_registered: true,
          cem_checked: false,
          status: "liberada",
        },
        activeProdBatchId: null,
        corrections: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("allows manager approval only after CEM and technical check", () => {
    expect(
      canApproveProd({
        prod: {
          status: "aguardando_aprovacao",
          cem_registered: true,
          cem_checked: true,
        },
        isManager: true,
      }),
    ).toMatchObject({ ok: true });
  });

  it("blocks technician-style approval without manager grant", () => {
    expect(
      canApproveProd({
        prod: {
          status: "aguardando_aprovacao",
          cem_registered: true,
          cem_checked: true,
        },
        isManager: false,
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("department delivery rules", () => {
  it("allows supplies to confirm lists only", () => {
    expect(
      canConfirmDepartmentDelivery({
        department: "suprimentos",
        deliveryType: "lista_materiais",
      }),
    ).toMatchObject({ ok: true });
    expect(
      canConfirmDepartmentDelivery({
        department: "suprimentos",
        deliveryType: "ordem_producao",
      }),
    ).toMatchObject({ ok: false });
  });

  it("allows production to confirm orders only", () => {
    expect(
      canConfirmDepartmentDelivery({
        department: "producao",
        deliveryType: "ordem_producao",
      }),
    ).toMatchObject({ ok: true });
    expect(
      canConfirmDepartmentDelivery({
        department: "producao",
        deliveryType: "lista_materiais",
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("release progress", () => {
  it("ignores canceled and logically deleted pieces", () => {
    expect(
      calculateReleaseProgress([
        { status: "liberada", deleted_at: null },
        { status: "aguardando_avaliacao", deleted_at: null },
        { status: "cancelada", deleted_at: null },
        { status: "liberada", deleted_at: "2026-07-30T12:00:00Z" },
      ]),
    ).toEqual({ total: 2, released: 1, balance: 1, percent: 50 });
  });
});
