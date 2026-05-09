/**
 * Run before deploy: validates required env for Vercel-style production.
 * Usage: node scripts/check-deploy-env.cjs
 */
function resolvedMasterEmail() {
  const a = (process.env.MASTER_ADMIN_EMAIL ?? "").trim();
  const b = (process.env.MASTER_SUPER_ADMIN_EMAIL ?? "").trim();
  return (a || b).trim().toLowerCase();
}

function resolvedMasterPassword() {
  return (
    process.env.MASTER_ADMIN_PASSWORD ??
    process.env.MASTER_SUPER_ADMIN_PASSWORD ??
    ""
  );
}

const requiredSupabase = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
];

function main() {
  const missingSupabase = requiredSupabase.filter((k) => !process.env[k]?.trim());
  if (missingSupabase.length) {
    console.error("[check-deploy-env] Missing:", missingSupabase.join(", "));
    process.exit(1);
  }

  const masterEmail = resolvedMasterEmail();
  if (!masterEmail) {
    console.error(
      "[check-deploy-env] Set MASTER_ADMIN_EMAIL (or legacy MASTER_SUPER_ADMIN_EMAIL).",
    );
    process.exit(1);
  }

  const masterPw = resolvedMasterPassword();
  if (!masterPw.trim().length) {
    console.error(
      "[check-deploy-env] Set MASTER_ADMIN_PASSWORD (or legacy MASTER_SUPER_ADMIN_PASSWORD).",
    );
    process.exit(1);
  }

  const secret = process.env.MASTER_SESSION_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    console.error(
      "[check-deploy-env] MASTER_SESSION_SECRET must be at least 32 characters.",
    );
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
