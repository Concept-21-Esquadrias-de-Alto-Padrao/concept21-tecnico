import { describe, expect, it } from "vitest";
import { findBestContractNumberMatch, normalizeContractNumberKey, sameContractNumber } from "./contract-number";

describe("contract number normalization", () => {
  it("treats single-digit year extractions as the same contract", () => {
    expect(normalizeContractNumberKey("6-0715")).toBe("26-0715");
    expect(normalizeContractNumberKey("26-0715")).toBe("26-0715");
    expect(sameContractNumber("6-0715", "26-0715")).toBe(true);
  });

  it("keeps additive suffixes together", () => {
    expect(normalizeContractNumberKey("26-0558 AD")).toBe("26-0558AD");
    expect(normalizeContractNumberKey("26-0558AD")).toBe("26-0558AD");
    expect(sameContractNumber("26-0558 AD", "26-0558AD")).toBe(true);
  });

  it("finds compatible contract rows when the stored number came from a rough PDF read", () => {
    const match = findBestContractNumberMatch(
      [
        { id: "first", contract_number: "25-0080" },
        { id: "beoos", contract_number: "6-0715" },
      ],
      "26-0715",
    );

    expect(match).toMatchObject({ id: "beoos" });
  });

  it("prefers the exact row when exact and compatible rows both exist", () => {
    const match = findBestContractNumberMatch(
      [
        { id: "rough", contract_number: "6-0715" },
        { id: "exact", contract_number: "26-0715" },
      ],
      "26-0715",
    );

    expect(match).toMatchObject({ id: "exact" });
  });
});
