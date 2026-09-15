import { NextResponse } from "next/server";
import { getMyActivities } from "@/lib/my-activities-server";
import { getHttpStatus } from "@/lib/server-access";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return NextResponse.json({ items: await getMyActivities() }, { headers });
  } catch (error) {
    const status = getHttpStatus(error);
    if (status >= 500) console.error("Falha ao consultar minhas atividades", error);
    return NextResponse.json({ error: status === 401 ? "Sua sessão expirou. Entre novamente."
      : status === 403 ? "Você não possui acesso às atividades deste módulo."
        : "Não foi possível consultar suas atividades. Tente atualizar novamente." }, { status, headers });
  }
}
