import { NextResponse } from "next/server";
import { checkCorporateAccess } from "@/lib/corporate-access-server";

export async function POST(request: Request) {
  if (process.env.CORPORATE_GATE_ENABLED !== "true")
    return NextResponse.json({ allowed: false }, { status: 404 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))
    return NextResponse.json({ allowed: false }, { status: 401 });
  const access = await checkCorporateAccess(authorization.slice(7));
  return NextResponse.json({ allowed: access === "allowed" }, {
    status: access === "allowed" ? 200 : access === "revoked" ? 403 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
