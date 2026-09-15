import { describe, expect, it } from "vitest";
import { actionSchema, meetingSchema, pieceStructuralChangeSchema } from "@/lib/schemas";

const contractId = "00000000-0000-4000-8000-000000000001";
const profileId = "00000000-0000-4000-8000-000000000002";
const pieceId = "00000000-0000-4000-8000-000000000003";

describe("technical action requirements", () => {
  it("requires a brief description and a responsible profile for a general action", () => {
    const missing = actionSchema.safeParse({
      contract_id: contractId,
      title: "P1",
      description: "",
      responsible_profile_id: "",
      priority: "normal",
    });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      "Descreva brevemente a ação.",
      "Selecione o responsável pela ação.",
    ]));

    expect(actionSchema.safeParse({
      contract_id: contractId,
      title: "P1",
      description: "Confirmar a definição da peça com o cliente.",
      responsible_profile_id: profileId,
      priority: "normal",
    }).success).toBe(true);
  });

  it("requires description and responsible only when the meeting creates an action", () => {
    const meeting = {
      contract_id: contractId,
      meeting_date: "2026-09-15",
      participants: "Equipe técnica",
    };
    expect(meetingSchema.safeParse(meeting).success).toBe(true);

    const incomplete = meetingSchema.safeParse({ ...meeting, create_action_title: "P1" });
    expect(incomplete.success).toBe(false);
    expect(incomplete.error?.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      "Descreva brevemente a ação.",
      "Selecione o responsável pela ação.",
    ]));

    expect(meetingSchema.safeParse({
      ...meeting,
      create_action_title: "P1",
      create_action_description: "Definir o acabamento da peça.",
      create_action_responsible_profile_id: profileId,
    }).success).toBe(true);
  });

  it("requires a responsible profile for a structural change", () => {
    expect(pieceStructuralChangeSchema.safeParse({
      piece_id: pieceId,
      description: "Alterar o sistema de abertura da peça.",
      responsible_profile_id: "",
      priority: "alta",
      financial_impact: "a_avaliar",
    }).success).toBe(false);
  });
});
