import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import LoginForm from './LoginForm'
import { resolveAdminHomeHref } from '@/lib/master-admin-access'

export const metadata: Metadata = { title: 'Sign in — LocalReach' }

type Props = { searchParams: Promise<{ message?: string; error?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect(resolveAdminHomeHref(user))
  }

  const q = await searchParams
  const flash =
    q.message === 'password_updated'
      ? { kind: 'ok' as const, text: 'Password updated — sign in with your new password.' }
      : q.error === 'recovery_session'
        ? { kind: 'err' as const, text: 'Open the reset link from your email again, then set your password.' }
        : typeof q.error === 'string'
          ? { kind: 'err' as const, text: decodeURIComponent(q.error) }
          : null

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center space-y-2">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach
          </p>
          <div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Admin Sign In</h1>
            <p className="mt-1.5 text-xs text-slate-500 leading-snug px-2">
              店舗オーナー用（発行済みの Supabase アカウント）。親・マスター管理は別URLです。
            </p>
            <Link
              href="/master-admin/login"
              className="mt-2 inline-block text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900"
            >
              マスター（親コンソール）のログインはこちら → /master-admin/login
            </Link>
          </div>
        </div>
        {flash && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              flash.kind === 'ok'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {flash.text}
          </div>
        )}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          <Link href="/admin/forgot-password" className="font-semibold text-slate-700 hover:text-slate-900">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  )
}
