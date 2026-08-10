import { describe, expect, it } from "vitest";
import { toUserFriendlyErrorMessage } from "./errors";

describe("toUserFriendlyErrorMessage", () => {
  it("translates duplicated technical piece codes", () => {
    expect(
      toUserFriendlyErrorMessage({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "technical_pieces_code_active_idx"',
      }),
    ).toContain("peças com o mesmo código");
  });

  it("keeps user-facing validation messages", () => {
    expect(toUserFriendlyErrorMessage(new Error("Informe o cliente antes de gravar."))).toBe(
      "Informe o cliente antes de gravar.",
    );
  });
});
