import { createHmac, createHash, timingSafeEqual } from "crypto";
import { resolvedMasterAdminEmail } from "@/lib/master-admin-env";

export const MASTER_SESSION_COOKIE_NAME = "lr_master_session";

/** Default session length (seconds). */
export const MASTER_SESSION_TTL_SEC = 60 * 60 * 12;

function getSecret(): string {
  return process.env.MASTER_SESSION_SECRET?.trim() ?? "";
}

function hmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("base64url");
}

export type MasterSessionPayload = { sub: string; exp: number };

export function signMasterSessionToken(email: string, ttlSec: number): string {
  const secret = getSecret();
  if (!secret) throw new Error("MASTER_SESSION_SECRET is not set");
  const sub = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload: MasterSessionPayload = { sub, exp };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = hmac(body, secret);
  return `${body}.${sig}`;
}

/** Returns authenticated master email if valid; otherwise null. */
export function verifyMasterSessionToken(token: string | undefined | null): string | null {
  if (!token?.includes(".")) return null;
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = hmac(body, secret);
  try {
    if (expectedSig.length !== sig.length || !timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig))) {
      return null;
    }
  } catch {
    return null;
  }
  let payload: MasterSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MasterSessionPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.sub !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  const expectedEmail = resolvedMasterAdminEmail();
  if (!expectedEmail || payload.sub !== expectedEmail) return null;
  return payload.sub;
}

function hashPw(pw: string): Buffer {
  return createHash("sha256").update(pw, "utf8").digest();
}

/** Constant-time-ish compare via fixed-length SHA-256 digests */
export function masterPasswordMatches(input: string, expectedPlainFromEnv: string): boolean {
  try {
    return timingSafeEqual(hashPw(input), hashPw(expectedPlainFromEnv));
  } catch {
    return false;
  }
}
