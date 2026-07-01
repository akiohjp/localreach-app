import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes Supabase Auth cookies on every matched request so Server Components
 * (e.g. /admin, /admin/login) see the same session as the browser client.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Default-deny gating (defense-in-depth; pages also guard themselves) ──

  // /admin/* → requires a Supabase session, except the auth entry points.
  const isAdminArea = pathname.startsWith("/admin");
  const isAdminAuthPage =
    pathname === "/admin/login" ||
    pathname === "/admin/forgot-password" ||
    pathname === "/admin/update-password";
  if (isAdminArea && !isAdminAuthPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // /master-admin/* → requires the master session cookie. This is a presence
  // check only (Edge runtime can't run the HMAC verify); the page + server
  // actions do full verification via getMasterSessionEmail().
  // Cookie name mirrors MASTER_SESSION_COOKIE_NAME in lib/master-session.ts
  // (inlined so this Edge middleware doesn't import node:crypto).
  const isMasterArea = pathname.startsWith("/master-admin");
  const isMasterAuthPage = pathname === "/master-admin/login";
  if (isMasterArea && !isMasterAuthPage) {
    const hasMasterCookie = Boolean(
      request.cookies.get("lr_master_session")?.value,
    );
    if (!hasMasterCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/master-admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
