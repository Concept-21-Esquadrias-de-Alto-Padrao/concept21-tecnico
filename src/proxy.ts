import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { secureOrigin } from "@/lib/portal-session-policy";

// These routes complete a Portal entry or exit and must work without a module session.
const sessionTransitions = new Set(["/auth/portal-entry", "/auth/complete", "/auth/portal-logout"]);

export async function proxy(request: NextRequest) {
  const portal = secureOrigin(process.env.NEXT_PUBLIC_PORTAL_ORIGIN);
  if (!portal) return new NextResponse("A entrada pelo Portal não está configurada.", { status: 503 });
  const toPortal = () => {
    const response = NextResponse.redirect(portal + "/", { status: 303 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/cadastro" || path === "/auth/callback") return toPortal();
  if (sessionTransitions.has(path)) return NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return toPortal();
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const auth = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: (items, headers) => {
      items.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      response.headers.set("Cache-Control", "private, no-store");
      items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
    },
  } });
  try {
    const { data: { user }, error } = await auth.auth.getUser();
    if (!error && user) return response;
  } catch { /* An unavailable or invalid session never renders a module page. */ }
  const redirect = toPortal();
  response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|brand(?:/|$)|icons(?:/|$)|favicon.ico$|manifest.webmanifest$|robots.txt$|sitemap.xml$|sw.js$).*)"],
};
