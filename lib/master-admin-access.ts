import type { User } from "@supabase/supabase-js";

/**
 * MASTER_ADMIN_ALLOWED_EMAILS: comma-separated, case-insensitive.
 * When set, only listed emails may use /master-admin even if role is super_admin.
 * When unset/empty → any super_admin can access master (legacy; dev convenience).
 */
function parseAllowedEmails(): Set<string> | null {
  const raw = process.env.MASTER_ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return null;
  return new Set(list);
}

/** True if whitelist is inactive OR email is listed. */
export function isMasterAdminEmailListed(email: string | undefined): boolean {
  const allowed = parseAllowedEmails();
  if (!allowed) return true;
  const e = email?.trim().toLowerCase();
  return !!e && allowed.has(e);
}

/** Uses role + optional email whitelist. */
export function canUseMasterDashboard(user: User | null): boolean {
  if (!user) return false;
  if (user.app_metadata?.role !== "super_admin") return false;
  return isMasterAdminEmailListed(user.email ?? undefined);
}

/** Post-login routing for admin routes. */
export function resolveAdminHomeHref(user: User): "/master-admin" | "/admin" {
  return canUseMasterDashboard(user) ? "/master-admin" : "/admin";
}
