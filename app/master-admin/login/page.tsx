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
            <strong className="font-semibold text-slate-800">マスター（親）はこの下のフォームだけ</strong>
            を使ってください。Supabase の店舗アカウントではありません。
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            認証情報は <strong className="font-semibold text-slate-800">Vercel 等の環境変数</strong> の{" "}
            <code className="text-[11px] bg-slate-100 px-1 rounded">MASTER_ADMIN_EMAIL</code> /{" "}
            <code className="text-[11px] bg-slate-100 px-1 rounded">MASTER_ADMIN_PASSWORD</code>
            です。変更したら再デプロイが必要です。
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-200/80 pt-3">
            既にマスターから発行されたアカウントで店を編集する場合のみ →{" "}
            <Link href="/admin/login" className="font-semibold text-slate-600 underline hover:text-slate-900">
              店舗オーナー用 /admin/login
            </Link>
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <MasterLoginForm />
        </div>
      </div>
    </div>
  );
}
