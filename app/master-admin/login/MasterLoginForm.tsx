"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  loginMasterAction,
  type MasterLoginState,
} from "./actions";

const INITIAL: MasterLoginState = {};

export default function MasterLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginMasterAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="master-email"
          className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500"
        >
          Master email
        </label>
        <input
          id="master-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
            text-sm text-slate-900 placeholder:text-slate-400 outline-none
            focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
          placeholder="master@yourdomain.com"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="master-password"
          className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500"
        >
          Password
        </label>
        <input
          id="master-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
            text-sm text-slate-900 placeholder:text-slate-400 outline-none
            focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
          placeholder="••••••••"
        />
      </div>

      {state.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 rounded-xl
          bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm
          hover:bg-slate-800 active:scale-[0.98] transition-all
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in to Master"
        )}
      </button>
    </form>
  );
}
