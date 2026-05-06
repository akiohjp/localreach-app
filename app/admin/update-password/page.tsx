import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import UpdatePasswordForm from "./UpdatePasswordForm";

export const metadata: Metadata = { title: "New password — LocalReach" };

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin/login?error=recovery_session");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center space-y-1">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach
          </p>
          <h1 className="text-xl font-bold text-slate-900">Set new password</h1>
          <p className="text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <UpdatePasswordForm />
        </div>
        <p className="mt-6 text-center text-[11px] text-slate-400">
          <Link href="/admin/login" className="hover:text-slate-600">
            Cancel and go to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
