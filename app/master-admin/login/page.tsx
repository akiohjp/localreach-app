import type { Metadata } from "next";
import Link from "next/link";
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
          <h1 className="text-xl font-bold text-slate-900">マスターアドミン</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            ログイン情報はすべて <strong className="font-semibold text-slate-800">サーバー側の環境変数（Vercel など）</strong> の{" "}
            <code className="text-[11px] bg-slate-100 px-1 rounded">MASTER_ADMIN_EMAIL</code> と{" "}
            <code className="text-[11px] bg-slate-100 px-1 rounded">MASTER_ADMIN_PASSWORD</code>
            で決まります。パスワードを変えるときは環境変数を更新して再デプロイしてください。
            各店のアドミンは{" "}
            <Link href="/admin/login" className="font-semibold text-slate-800 underline">
              Admin サインイン
            </Link>
            へ。
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <MasterLoginForm />
        </div>
      </div>
    </div>
  );
}
