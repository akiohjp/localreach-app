'use client'

/**
 * Owner-facing "subscription paused" screen. The guest /inactive page is a
 * customer dead-end by design; owners must NOT land there (no sign-out, no
 * next step). This page tells the owner what happened and lets them contact
 * us or sign out / switch accounts.
 */

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AdminPausedPage() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl" aria-hidden>
          ⏸
        </div>
        <h1 className="text-xl font-bold text-slate-900">Your subscription is paused</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          This store&apos;s LocalReach service is currently inactive, so the dashboard and
          the guest review page are offline. Your data (customers, feedback, settings)
          is safe and will be right here when the service resumes.
        </p>
        <p className="text-sm text-slate-600">
          To reactivate, contact us on WhatsApp or reply to your latest invoice.
        </p>
        <div className="pt-2 flex flex-col gap-2">
          <a
            href="https://wa.me/971549967498"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Contact us on WhatsApp
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  )
}
