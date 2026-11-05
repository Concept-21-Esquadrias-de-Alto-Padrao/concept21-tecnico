import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TechnicalSnapshot } from "./types";
import { filterSnapshotToVisibleContracts } from "./technical-data";

// Explicitly unavailable in Production. The private snapshot is never committed.
export async function readDashboardPreview(isMaster: boolean) {
  if (!isMaster || process.env.VERCEL_ENV !== "preview" || process.env.C21_DASHBOARD_SNAPSHOT !== "1") return null;
  const data = JSON.parse(await readFile(path.join(process.cwd(), ".dashboard-preview.json"), "utf8")) as {capturedAt:string;snapshot:TechnicalSnapshot};
  filterSnapshotToVisibleContracts(data.snapshot);
  return data;
}
