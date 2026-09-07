import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isQrHost, SLUG_PATH_RE } from "@/lib/store-links";

/**
 * Refreshes Supabase Auth cookies on every matched request so Server Components
 * (e.g. /admin, /admin/login) see the same session as the browser client.
 *
 * Also the front door of the short QR host: on https://<NEXT_PUBLIC_QR_HOST>,
 * "/x7kp2m" IS the store page (rewritten, not redirected, so the address bar
 * keeps the short link), and "/" goes to the product site. Everything else on
 * that host falls through to the app as usual.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isQrHost(request.headers.get("host"))) {
    const short = SLUG_PATH_RE.exec(pathname);
    if (short) {
      const url = request.nextUrl.clone();
      url.pathname = `/r/${short[1]}`;
      return NextResponse.rewrite(url);
    }
    if (pathname === "/") {
      return NextResponse.redirect(
        process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://miraireach.ae/",
      );
    }
  }

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
