/**
 * Master (親) console credentials live in env — not Supabase Auth.
 *
 * Prefer MASTER_ADMIN_EMAIL / MASTER_ADMIN_PASSWORD.
 * MASTER_SUPER_ADMIN_* is still read as a fallback during migration only.
 */

export function resolvedMasterAdminEmail(): string {
  const a = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase() ?? ""
  const b = process.env.MASTER_SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? ""
  return (a || b).trim().toLowerCase()
}

export function resolvedMasterAdminPassword(): string {
  return (
    process.env.MASTER_ADMIN_PASSWORD ??
    process.env.MASTER_SUPER_ADMIN_PASSWORD ??
    ""
  )
}
