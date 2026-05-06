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
