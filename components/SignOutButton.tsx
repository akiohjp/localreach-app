'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

/** Small client-side sign-out for server-rendered dead-end states (e.g. an
 *  owner signed into the wrong Google account on the zero-stores page). */
export default function SignOutButton({ label = 'Sign out' }: { label?: string }) {
  const router = useRouter()
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex items-center justify-center rounded-xl border border-gray-300
        px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
    >
      {label}
    </button>
  )
}
