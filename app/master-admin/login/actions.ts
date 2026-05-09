"use server";

import { redirect } from "next/navigation";
import {
  resolvedMasterAdminEmail,
  resolvedMasterAdminPassword,
} from "@/lib/master-admin-env";
import { masterPasswordMatches } from "@/lib/master-session";
import {
  clearMasterSessionCookie,
  setMasterSessionCookie,
} from "@/lib/master-session-server";

const sleep = () => new Promise((r) => setTimeout(r, 400));

export async function loginMasterAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const expectedEmail = resolvedMasterAdminEmail();
  const expectedPw = resolvedMasterAdminPassword();
  const secret = process.env.MASTER_SESSION_SECRET?.trim() ?? "";

  if (!expectedEmail || !expectedPw.trim() || !secret) {
    await sleep();
    return { ok: false, error: "Master login is not configured on the server." };
  }

  if (
    email.toLowerCase() !== expectedEmail ||
    !masterPasswordMatches(password, expectedPw)
  ) {
    await sleep();
    return { ok: false, error: "Invalid email or password." };
  }

  await setMasterSessionCookie(expectedEmail);
  return { ok: true };
}

export async function logoutMasterAction() {
  await clearMasterSessionCookie();
  redirect("/master-admin/login");
}
