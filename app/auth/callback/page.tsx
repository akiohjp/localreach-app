"use client";

import { Suspense, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { resolvePostLoginPath } from "@/app/admin/login/actions";

function wantsPasswordReset(page: URL, hashParams: URLSearchParams): boolean {
  if (page.searchParams.get("next") === "recovery") return true;
  return hashParams.get("type") === "recovery";
}

/** PKCE (?code=) or legacy hash (#access_token= + refresh_token=). Route Handlers cannot read #hash — must be client. */
function RecoverSession() {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createClient();
      const page = new URL(window.location.href);
      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = page.searchParams.get("code");

      async function goAfterSession() {
        if (cancelled) return;
        const dest = wantsPasswordReset(page, hp)
          ? "/admin/update-password"
          : await resolvePostLoginPath();
        window.location.replace(dest);
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          window.location.replace(
            `/admin/login?error=${encodeURIComponent(error.message)}`,
          );
          return;
        }
        await goAfterSession();
        return;
      }

      const access_token = hp.get("access_token");
      const refresh_token = hp.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (cancelled) return;
        if (error) {
          window.location.replace(
            `/admin/login?error=${encodeURIComponent(error.message)}`,
          );
          return;
        }
        await goAfterSession();
        return;
      }

      window.location.replace(
        "/admin/login?error=" +
          encodeURIComponent(
            "Invalid or expired reset link. Try Forgot password again, and add this URL to Supabase Redirect URLs.",
          ),
      );
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <p className="text-sm text-slate-600">Confirming recovery link…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<RecoverSessionFallback />}>
      <RecoverSession />
    </Suspense>
  );
}

function RecoverSessionFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <p className="text-sm text-slate-600">Loading…</p>
    </div>
  );
}
