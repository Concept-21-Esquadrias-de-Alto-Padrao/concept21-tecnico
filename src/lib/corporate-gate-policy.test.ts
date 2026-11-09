import { describe, expect, it } from "vitest";
import { reviewedGateUpdateMatches } from "./corporate-gate-policy";
const expected = {
  authUserId: "11111111-2222-4333-8444-555555555555",
  portalLinkId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  rhSubject: "99999999-8888-4777-8666-555555555555",
};

describe("scoped corporate link synchronization", () => {
  it("accepts only the reviewed three UUIDs for both revoke and restore", () => {
    expect(reviewedGateUpdateMatches({ ...expected, allowed: false }, expected)).toBe(true);
    expect(reviewedGateUpdateMatches({ ...expected, allowed: true }, expected)).toBe(true);
  });
  it.each(["authUserId", "portalLinkId", "rhSubject"] as const)("rejects a crossed %s", key => {
    expect(reviewedGateUpdateMatches({ ...expected, [key]: "00000000-0000-4000-8000-000000000000", allowed: true }, expected)).toBe(false);
    expect(reviewedGateUpdateMatches({ ...expected, allowed: true }, { ...expected, [key]: undefined })).toBe(false);
  });
  it("rejects malformed IDs, metadata and truthy non-booleans", () => {
    expect(reviewedGateUpdateMatches({ ...expected, rhSubject: "user@example.com", allowed: true }, expected)).toBe(false);
    expect(reviewedGateUpdateMatches({ ...expected, allowed: "true" }, expected)).toBe(false);
    expect(reviewedGateUpdateMatches(null, expected)).toBe(false);
  });
});
