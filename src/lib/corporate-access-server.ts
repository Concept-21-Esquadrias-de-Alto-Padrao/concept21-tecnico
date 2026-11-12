import "server-only";
import { headers } from "next/headers";

export type CorporateAccess = "allowed" | "revoked" | "unavailable";

export async function checkCorporateAccess(token: string): Promise<CorporateAccess> {
  if (process.env.CORPORATE_GATE_ENABLED !== "true") return "allowed";
  const endpoint = process.env.PORTAL_CORPORATE_ACCESS_URL;
  if (!endpoint || !token) return "unavailable";
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.pathname !== "/api/internal/module-access" ||
        url.username || url.password || url.search || url.hash) return "unavailable";
    const oidcToken = url.hostname.endsWith(".vercel.app")
      ? (await headers()).get("x-vercel-oidc-token") : null;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`,
        ...(oidcToken ? { "x-vercel-trusted-oidc-idp-token": oidcToken } : {}) },
      body: JSON.stringify({ moduleKey: "technical" }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return "allowed";
    if (response.status === 401 || response.status === 403) return "revoked";
  } catch { /* Keep access closed when its corporate authority is unavailable. */ }
  return "unavailable";
}
