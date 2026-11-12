import assert from "node:assert/strict";
import { it as test } from "vitest";
import { secureOrigin, trustedReferrer, endBrowserSession } from "./portal-session-policy";

test("redirect destinations require a configured HTTPS origin", () => {
  assert.equal(secureOrigin("https://portal.example.com/"), "https://portal.example.com");
  for (const bad of [undefined, "", "http://portal.example.com", "https://u:p@portal.example.com", "https://portal.example.com/path", "https://portal.example.com?next=https://evil.example", "https://portal.example.com/#x"])
    assert.equal(secureOrigin(bad), null);
});
test("automatic logout rejects missing, unrelated, and deceptive referrers", () => {
  const origins = ["https://portal.example.com", null];
  assert.equal(trustedReferrer("https://portal.example.com/auth/logout", origins), true);
  for (const bad of [null, "https://evil.example/", "https://portal.example.com.evil.example/", "https://portal.example.com@evil.example/", "http://portal.example.com/"])
    assert.equal(trustedReferrer(bad, origins), false);
});
test("logout revokes only this browser session and waits for success", async () => {
  const calls: Array<{ scope: "local" }> = [];
  await endBrowserSession({ signOut: async options => { calls.push(options); return { error: null }; } });
  assert.deepEqual(calls, [{ scope: "local" }]);
  await assert.rejects(() => endBrowserSession({ signOut: async () => ({ error: new Error("network") }) }));
});
