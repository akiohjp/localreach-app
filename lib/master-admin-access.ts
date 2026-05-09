import type { User } from "@supabase/supabase-js";

/**
 * Roles（混同しないこと）:
 *
 * - **マスターアドミン（親）**: 環境変数のメール＋パスワードで `/master-admin/login`。店舗アカウント発行のみ。
 *   Supabase の「super_admin」ロールとは別物。**ここだけバックエンド（Vercel 環境変数）で全決め**してください。
 *
 * - **店舗アドミン（クライアント）**: マスターが発行した Supabase アカウントで `/admin/login`。
 *   自分の店の名前・ロゴ・キーワードなどを編集する。
 *
 * - **JWT `super_admin` / DB `is_super_admin()`**: 旧来の一覧用 RLS に残っていることがありますが、
 *   ダッシュボード `/admin/[id]` への入館は **owner_id のみ**です。
 */
export function resolveAdminHomeHref(_user: User): "/admin" {
  return "/admin";
}
