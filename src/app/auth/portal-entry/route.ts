import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { assertSupabasePublicConfig } from "@/lib/supabase/config";
import { secureOrigin, trustedReferrer } from "@/lib/portal-session-policy";

export async function GET(request: NextRequest) {
  const portal = secureOrigin(process.env.NEXT_PUBLIC_PORTAL_ORIGIN);
  const app = secureOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const failure = new URL("/login?auth_error=corporate", request.url);
  if (!portal || !app || request.nextUrl.origin !== app ||
      process.env.CENTRAL_LOGIN_PILOT_ENABLED !== "true" ||
      process.env.CORPORATE_GATE_ENABLED !== "true" ||
      !trustedReferrer(request.headers.get("referer"), [portal]))
    return NextResponse.redirect(failure, { status: 303 });

  const response = NextResponse.redirect(failure, { status: 303 });
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
  const { data, error } = await auth.auth.signInWithOAuth({
    provider: "custom:concept21",
    options: {
      redirectTo: app + "/auth/complete?next=%2Ftecnico",
      scopes: "openid email profile",
      skipBrowserRedirect: true,
    },
  });
  if (!error && data.url) response.headers.set("Location", data.url);
  return response;
}
