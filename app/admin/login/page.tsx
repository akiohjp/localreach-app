import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import LoginForm from './LoginForm'

export const metadata: Metadata = { title: 'Sign in — LocalReach' }

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect(user.app_metadata?.role === 'super_admin' ? '/master-admin' : '/admin')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Admin Sign In</h1>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
