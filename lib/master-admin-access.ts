import type { User } from "@supabase/supabase-js";

/**
 * Two sign-ins, never to be confused:
 *
 * - **Master (us)**: `/master-admin/login`, email + password from env only.
 *   It creates store accounts; it is not a Supabase user and has nothing to do
 *   with Supabase's own "super_admin" role.
 *
 * - **Store owner (the client)**: `/admin/login`, the Supabase account we
 *   issued them. They edit their own store — name, logo, keywords.
 *
 * A leftover JWT `super_admin` / `is_super_admin()` may still appear in older
 * list policies, but entry to `/admin/[id]` is decided by owner_id alone.
 */
export function resolveAdminHomeHref(_user: User): "/admin" {
  return "/admin";
}
