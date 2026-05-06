import path from "path";
import type { NextConfig } from "next";

/** Fail fast on Vercel production if required env is missing (avoids half-broken deploys). */
if (process.env.VERCEL_ENV === "production") {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
  ] as const;
  for (const key of required) {
    if (!process.env[key]?.trim()) {
      throw new Error(`[next.config] Missing required env on Vercel production: ${key}`);
    }
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appUrl.startsWith("https://")) {
    throw new Error(
      "[next.config] NEXT_PUBLIC_APP_URL must use https:// on Vercel production",
    );
  }
}

const nextConfig: NextConfig = {
  // Lock Turbopack to this app so `npm run dev` from the monorepo parent does not
  // pick the wrong workspace root (avoids stray warnings and extra file watching).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
