import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/** Only allow same-origin relative paths (open-redirect prevention). */
function safeNext(searchParams: URLSearchParams): string {
  const raw = searchParams.get("next");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/admin/update-password";
  }
  return raw;
}

/**
 * Handles Supabase PKCE redirects (magic link / password recovery).
 * Add this URL to Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = safeNext(url.searchParams);
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(
      `${origin}/admin/login?error=missing_code`,
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/admin/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
