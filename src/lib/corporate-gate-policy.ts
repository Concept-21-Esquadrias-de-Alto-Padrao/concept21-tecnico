const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Pair = { authUserId?: string; portalLinkId?: string; rhSubject?: string };

export function reviewedGateUpdateMatches(input: unknown, expected: Pair): input is {
  authUserId: string; portalLinkId: string; rhSubject: string; allowed: boolean;
} {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return typeof value.allowed === "boolean" &&
    (["authUserId", "portalLinkId", "rhSubject"] as const).every(key =>
      typeof value[key] === "string" && uuid.test(value[key] as string) &&
      Boolean(expected[key] && uuid.test(expected[key]) && value[key] === expected[key]));
}
