import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { assertSupabasePublicConfig } from "@/lib/supabase/config";
import { checkCorporateAccess } from "@/lib/corporate-access-server";
import { validCorporateCallback } from "@/lib/corporate-login-policy";

export async function GET(request: NextRequest) {
  const failure = new URL("/login?auth_error=corporate", request.url);
  const code = request.nextUrl.searchParams.get("code");
  if (process.env.CENTRAL_LOGIN_PILOT_ENABLED !== "true" ||
      process.env.CORPORATE_GATE_ENABLED !== "true" ||
      !validCorporateCallback(request.url, process.env.NEXT_PUBLIC_APP_URL) ||
      request.nextUrl.searchParams.get("next") !== "/tecnico" || !code)
    return NextResponse.redirect(failure, { status: 303 });

  const response = NextResponse.redirect(new URL("/tecnico", request.url), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  const { url, anonKey } = assertSupabasePublicConfig();
  const auth = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items, responseHeaders) => {
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(responseHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  const { data, error } = await auth.auth.exchangeCodeForSession(code);
  const access = !error && data.session
    ? await checkCorporateAccess(data.session.access_token) : "revoked";
  if (access !== "allowed") {
    await auth.auth.signOut({ scope: "local" }).catch(() => undefined);
    response.headers.set("Location", failure.toString());
  }
  return response;
}
