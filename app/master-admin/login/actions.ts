"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolvedMasterAdminEmail } from "@/lib/master-admin-env";
import { masterLoginConfigured, verifyMasterPassword } from "@/lib/master-session";
import {
  clearMasterSessionCookie,
  setMasterSessionCookie,
} from "@/lib/master-session-server";
import {
  checkMasterLoginAllowed,
  recordMasterLoginFailure,
  resetMasterLoginFailures,
} from "@/lib/master-login-rate-limit";

export type MasterLoginState = { error?: string };

const sleep = () => new Promise((r) => setTimeout(r, 400));

/** Rate-limit key: first hop of the forwarded client IP (best-effort). */
async function clientKey(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  return `master:${ip}`;
}

export async function loginMasterAction(
  _prev: MasterLoginState,
  formData: FormData,
): Promise<MasterLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const key = await clientKey();
  const gate = checkMasterLoginAllowed(key);
  if (!gate.allowed) {
    await sleep();
    const mins = Math.max(1, Math.ceil(gate.retryAfterSec / 60));
    return { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  if (!masterLoginConfigured()) {
    await sleep();
    return { error: "Master login is not configured on the server." };
  }

  const expectedEmail = resolvedMasterAdminEmail();
  if (email.toLowerCase() !== expectedEmail || !verifyMasterPassword(password)) {
    recordMasterLoginFailure(key);
    await sleep();
    return { error: "Invalid email or password." };
  }

  resetMasterLoginFailures(key);
  await setMasterSessionCookie(expectedEmail);
  redirect("/master-admin");
}

export async function logoutMasterAction() {
  await clearMasterSessionCookie();
  redirect("/master-admin/login");
}
