'use server'

import { createClient } from '@/utils/supabase/server'
import { resolveAdminHomeHref } from '@/lib/master-admin-access'

/** After browser sign-in, server reads session cookie and picks home path. */
export async function resolvePostLoginPath(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return '/admin/login'
  return resolveAdminHomeHref(user)
}
