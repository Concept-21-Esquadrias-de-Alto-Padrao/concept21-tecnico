import { NextResponse } from "next/server";
import { requireAuthenticatedProfile } from "@/lib/server-access";

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedProfile();
    const url = new URL(request.url);
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));

    const { data, error } = await context.admin
      .from("platform_notifications")
      .select("*")
      .eq("company_id", context.profile.company_id)
      .or(`recipient_profile_id.is.null,recipient_profile_id.eq.${context.profile.id}`)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json({ notifications: data ?? [] });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireAuthenticatedProfile();
    const payload = (await request.json()) as { notificationId?: string };
    if (!payload.notificationId) {
      return NextResponse.json({ error: "Notificação inválida." }, { status: 400 });
    }

    const { error } = await context.admin
      .from("platform_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("company_id", context.profile.company_id)
      .eq("id", payload.notificationId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar notificação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
