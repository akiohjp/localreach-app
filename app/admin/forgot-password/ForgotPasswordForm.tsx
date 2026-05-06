"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

function callbackUrl(): string {
  if (typeof window === "undefined") return "";
  const base = `${window.location.origin}/auth/callback?next=/admin/update-password`;
  return base;
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: callbackUrl(),
      },
    );
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Mail className="text-slate-600" size={24} strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Check your email</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            If an account exists for <span className="font-semibold">{email}</span>,
            we sent a reset link. Open it to set a new password.
          </p>
        </div>
        <Link
          href="/admin/login"
          className="inline-block text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
            text-sm text-slate-900 placeholder:text-slate-400 outline-none
            focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl
          bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm
          hover:bg-slate-800 active:scale-[0.98] transition-all
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Sending…
          </>
        ) : (
          "Send reset link"
        )}
      </button>

      <p className="text-center text-xs text-slate-500">
        <Link href="/admin/login" className="font-semibold text-slate-700 hover:text-slate-900">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
