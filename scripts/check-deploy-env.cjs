/**
 * Run before deploy: validates required env for Vercel-style production.
 * Usage: node scripts/check-deploy-env.cjs
 */
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "MASTER_ADMIN_ALLOWED_EMAILS",
];

function main() {
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error("[check-deploy-env] Missing:", missing.join(", "));
    process.exit(1);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isLocal = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  if (!isLocal && !appUrl.startsWith("https://")) {
    console.error(
      "[check-deploy-env] NEXT_PUBLIC_APP_URL must use https:// in production (got:",
      appUrl,
      ")",
    );
    process.exit(1);
  }

  console.log("[check-deploy-env] OK — required variables are set.");
}

main();
