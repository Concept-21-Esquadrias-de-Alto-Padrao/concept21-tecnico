import { describe, expect, it } from "vitest";
import { validCorporateCallback } from "./corporate-login-policy";

describe("corporate callback destination", () => {
  const origin = "https://technical.example.com";
  it("accepts the configured origin and fixed local callback", () => {
    expect(validCorporateCallback(origin + "/auth/complete?next=%2Ftecnico&code=abc", origin)).toBe(true);
  });
  it.each([
    ["https://other.example.com/auth/complete", origin],
    [origin + "/auth/complete", undefined],
    [origin + "/auth/complete", origin + "/tecnico"],
    ["http://technical.example.com/auth/complete", origin],
    [origin + "/auth/callback", origin],
    [origin + "/auth/complete#fragment", origin],
    ["https://user:pass@technical.example.com/auth/complete", origin],
    [origin + "/auth/complete", origin + "?token=secret"],
  ])("rejects an unconfigured or unexpected destination %s", (url, configured) => {
    expect(validCorporateCallback(url, configured)).toBe(false);
  });
});
