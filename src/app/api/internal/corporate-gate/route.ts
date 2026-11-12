import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { reviewedGateUpdateMatches } from "@/lib/corporate-gate-policy";

export async function POST(request: Request) {
  if (process.env.CORPORATE_GATE_ENABLED !== "true")
    return NextResponse.json({ error: "Indisponível." }, { status: 404 });
  const expected = process.env.PORTAL_GATE_SYNC_SECRET;
  const header = request.headers.get("authorization");
  if (!expected || expected.length < 32 || !header?.startsWith("Bearer ") ||
      !timingSafeEqual(createHash("sha256").update(expected).digest(),
        createHash("sha256").update(header.slice(7)).digest()))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const input: unknown = await request.json().catch(() => null);
  if (!reviewedGateUpdateMatches(input, {
    authUserId: process.env.CORPORATE_GATE_PILOT_USER_ID,
    portalLinkId: process.env.CORPORATE_GATE_PILOT_LINK_ID,
    rhSubject: process.env.CORPORATE_GATE_PILOT_RH_SUBJECT,
  })) return NextResponse.json({ error: "Vínculo fora do escopo aprovado." }, { status: 403 });
  const { error } = await getSupabaseAdminClient().from("corporate_gate_subjects").upsert({
    auth_user_id: input.authUserId, portal_link_id: input.portalLinkId,
    rh_subject: input.rhSubject, allowed: input.allowed, updated_at: new Date().toISOString(),
  }, { onConflict: "auth_user_id" });
  return NextResponse.json(error ? { error: "Não foi possível sincronizar o vínculo." } : { ok: true }, {
    status: error ? 503 : 200, headers: { "Cache-Control": "no-store" },
  });
}
