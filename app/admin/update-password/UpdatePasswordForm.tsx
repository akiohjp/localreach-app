"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    window.location.assign("/admin/login?message=password_updated");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="pw"
          className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500"
        >
          New password
        </label>
        <input
          id="pw"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
            text-sm text-slate-900 placeholder:text-slate-400 outline-none
            focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="pw2"
          className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500"
        >
          Confirm
        </label>
        <input
          id="pw2"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
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
            Updating…
          </>
        ) : (
          "Update password"
        )}
      </button>
    </form>
  );
}
