import type { Metadata } from "next";
import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password — LocalReach" };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center space-y-1">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach
          </p>
          <h1 className="text-xl font-bold text-slate-900">Reset password</h1>
          <p className="text-sm text-slate-500">
            We&apos;ll email you a link to choose a new password.
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed mt-2 text-left px-1">
            メールが一度も届かない場合は、アプリではなく&nbsp;
            <strong className="font-semibold text-slate-700">Supabase の SMTP（カスタム SMTP）</strong>
            が未設定のことが多いです。プロジェクト運用メンバーでも、Org メンバー以外へは送信制限になる場合があります。
            <a
              href="https://supabase.com/docs/guides/auth/auth-smtp"
              target="_blank"
              rel="noreferrer"
              className="ml-1 text-slate-900 font-semibold underline underline-offset-2"
            >
              設定方法（公式）
            </a>
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 text-center text-[11px] text-slate-400">
          <Link href="/" className="hover:text-slate-600">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
