import { cookies } from "next/headers";
import {
  MASTER_SESSION_COOKIE_NAME,
  MASTER_SESSION_TTL_SEC,
  signMasterSessionToken,
  verifyMasterSessionToken,
} from "@/lib/master-session";

/** Email of the authenticated master user, or null. */
export async function getMasterSessionEmail(): Promise<string | null> {
  const jar = await cookies();
  return verifyMasterSessionToken(jar.get(MASTER_SESSION_COOKIE_NAME)?.value);
}

export async function setMasterSessionCookie(email: string): Promise<void> {
  const token = signMasterSessionToken(email, MASTER_SESSION_TTL_SEC);
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(MASTER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MASTER_SESSION_TTL_SEC,
  });
}

export async function clearMasterSessionCookie(): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(MASTER_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
