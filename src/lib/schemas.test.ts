import { describe, expect, it } from "vitest";
import { directContractDeletionSchema, stageValidationSchema } from "./schemas";

describe("stageValidationSchema", () => {
  const basePayload = {
    contract_id: "00000000-0000-4000-8000-000000000001",
    stage: "entrada_comercial",
  };

  it("treats an unchecked validation checkbox as false", () => {
    const parsed = stageValidationSchema.safeParse(basePayload);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.validation_required).toBe(false);
    }
  });

  it("treats a checked validation checkbox as true", () => {
    const parsed = stageValidationSchema.safeParse({
      ...basePayload,
      validation_required: "on",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.validation_required).toBe(true);
    }
  });
});

describe("directContractDeletionSchema", () => {
  it("requires a contract, typed confirmation and deletion reason", () => {
    const parsed = directContractDeletionSchema.safeParse({
      contract_id: "00000000-0000-4000-8000-000000000001",
      confirmation: "26-0715",
      reason: "lançamento duplicado",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a deletion without a clear reason", () => {
    const parsed = directContractDeletionSchema.safeParse({
      contract_id: "00000000-0000-4000-8000-000000000001",
      confirmation: "26-0715",
      reason: "",
    });

    expect(parsed.success).toBe(false);
  });
});
