import { describe, expect, it } from "vitest";
import { ensureUniqueTechnicalPieceCodes, findDuplicateTechnicalPieceCodes } from "./technical-piece-codes";

describe("technical piece codes", () => {
  it("adds suffixes to repeated codes", () => {
    const result = ensureUniqueTechnicalPieceCodes([
      { code: "P1" },
      { code: "p1" },
      { code: "P1" },
    ]);

    expect(result.adjustedCount).toBe(2);
    expect(result.duplicateCodes).toEqual(["p1"]);
    expect(result.pieces.map((piece) => piece.code)).toEqual(["P1", "p1-02", "P1-03"]);
  });

  it("finds duplicated codes in an import", () => {
    expect(findDuplicateTechnicalPieceCodes([{ code: "PT-MUX" }, { code: "PT-MUX" }])).toEqual([
      "PT-MUX",
    ]);
  });
});
