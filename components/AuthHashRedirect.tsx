"use client";

import { useEffect } from "react";

/**
 * Magic / recovery emails often redirect to Site URL (e.g. `/`) with
 * `#access_token=...` — hashes never reach the server. Normalize to `/auth/callback`.
 */
export function AuthHashRedirect() {
  useEffect(() => {
    if (window.location.pathname === "/auth/callback") return;

    const { search, hash } = window.location;
    const hasCode = new URLSearchParams(search).has("code");
    const hp = new URLSearchParams(hash.replace(/^#/, ""));
    const hasImplicit =
      hp.has("access_token") && hp.has("refresh_token");

    if (hasCode || hasImplicit) {
      window.location.replace(`/auth/callback${search}${hash}`);
    }
  }, []);

  return null;
}
