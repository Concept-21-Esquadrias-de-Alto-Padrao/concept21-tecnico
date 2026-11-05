import { afterEach, describe, expect, it, vi } from "vitest";
import { readDashboardPreview } from "./dashboard-preview";
vi.mock("./technical-data", () => ({filterSnapshotToVisibleContracts:vi.fn()}));
afterEach(()=>vi.unstubAllEnvs());
describe("read-only dashboard preview isolation",()=>{
 it("never loads copied data in production, even with the flag enabled",async()=>{vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("C21_DASHBOARD_SNAPSHOT","1");expect(await readDashboardPreview(true)).toBeNull();});
 it("does not expose copied works to non-master accounts",async()=>{vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("C21_DASHBOARD_SNAPSHOT","1");expect(await readDashboardPreview(false)).toBeNull();});
});
