import path from "path";
import type { NextConfig } from "next";
import {
  resolvedMasterAdminEmail,
  resolvedMasterAdminPassword,
} from "./lib/master-admin-env";

/** Fail fast on Vercel (production + preview) if required env is missing. */
const vercelBuild =
  process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";

if (vercelBuild) {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
  ] as const;
  for (const key of required) {
    if (!process.env[key]?.trim()) {
      throw new Error(`[next.config] Missing required env on Vercel: ${key}`);
    }
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appUrl.startsWith("https://")) {
    throw new Error(
      "[next.config] NEXT_PUBLIC_APP_URL must use https:// on Vercel",
    );
  }
  const masterEmail = resolvedMasterAdminEmail();
  const masterPw = resolvedMasterAdminPassword();
  const masterSecret = process.env.MASTER_SESSION_SECRET?.trim();
  if (!masterEmail) {
    throw new Error(
      "[next.config] Set MASTER_ADMIN_EMAIL (legacy: MASTER_SUPER_ADMIN_EMAIL) on Vercel for /master-admin/login.",
    );
  }
  if (!masterPw.trim().length) {
    throw new Error(
      "[next.config] Set MASTER_ADMIN_PASSWORD (legacy: MASTER_SUPER_ADMIN_PASSWORD) on Vercel — rotate via env only.",
    );
  }
  if (!masterSecret || masterSecret.length < 32) {
    throw new Error(
      "[next.config] MASTER_SESSION_SECRET must be set on Vercel and at least 32 characters.",
    );
  }
}

const nextConfig: NextConfig = {
  // Lock Turbopack to this app so `npm run dev` from the monorepo parent does not
  // pick the wrong workspace root (avoids stray warnings and extra file watching).
  turbopack: {
    root: path.join(__dirname),
  },
  // Baseline security headers. The guest page is QR-opened (never legitimately
  // embedded), so denying framing is free clickjacking protection. A full
  // script-src CSP is deliberately NOT set here — Next.js inline runtime chunks
  // would need nonces and an untested strict CSP can take the whole app down;
  // frame-ancestors covers the framing vector without that risk.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
