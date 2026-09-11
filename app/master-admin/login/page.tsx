import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMasterSessionEmail } from "@/lib/master-session-server";
import MasterLoginForm from "./MasterLoginForm";

export const metadata: Metadata = { title: "Master Sign In — LocalReach" };

export default async function MasterLoginPage() {
  const master = await getMasterSessionEmail();
  if (master) redirect("/master-admin");

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center space-y-2">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach
          </p>
          <h1 className="text-xl font-bold text-slate-900">Master sign in</h1>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <MasterLoginForm />
        </div>
      </div>
    </div>
  );
}
