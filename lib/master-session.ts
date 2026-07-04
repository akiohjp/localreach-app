import { createHmac, createHash, timingSafeEqual } from "crypto";
import {
  resolvedMasterAdminEmail,
  resolvedMasterAdminPassword,
  resolvedMasterAdminPasswordSha256,
} from "@/lib/master-admin-env";

export const MASTER_SESSION_COOKIE_NAME = "lr_master_session";

/** Default session length (seconds). */
export const MASTER_SESSION_TTL_SEC = 60 * 60 * 12;

function getSecret(): string {
  return process.env.MASTER_SESSION_SECRET?.trim() ?? "";
}

function hmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("base64url");
}

/**
 * Lowercase hex SHA-256 of the configured master password, from either the
 * hashed env (preferred) or the plaintext env. Returns "" when unconfigured.
 * This is the single source of truth for both password verification and the
 * session password-fingerprint, so they can never drift apart.
 */
function masterPasswordHashHex(): string {
  const hashed = resolvedMasterAdminPasswordSha256();
  if (hashed) return hashed;
  const plain = resolvedMasterAdminPassword();
  if (!plain) return "";
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

/** True when email + secret + a password (hashed or plaintext) are all present. */
export function masterLoginConfigured(): boolean {
  return Boolean(getSecret() && resolvedMasterAdminEmail() && masterPasswordHashHex());
}

/**
 * Constant-time password check. Compares fixed-length SHA-256 digests so it
 * works identically whether the server holds the plaintext or only the hash,
 * and never branches on the secret's contents.
 */
export function verifyMasterPassword(input: string): boolean {
  const expectedHex = masterPasswordHashHex();
  if (!expectedHex) return false;
  const inputHex = createHash("sha256").update(input, "utf8").digest("hex");
  try {
    const a = Buffer.from(inputHex, "hex");
    const b = Buffer.from(expectedHex, "hex");
    // Guard against a malformed MASTER_ADMIN_PASSWORD_SHA256 (non-hex / wrong length).
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Short fingerprint of the current credential, keyed by the session secret.
 * Embedded in every token; recomputed on verify. When the master password (or
 * its SHA-256 env) changes, this changes too, so all previously-issued sessions
 * stop validating — i.e. changing the password revokes existing logins.
 */
function passwordVersion(secret: string): string {
  return hmac("pv:" + masterPasswordHashHex(), secret).slice(0, 16);
}

export type MasterSessionPayload = { sub: string; exp: number; pv: string };

export function signMasterSessionToken(email: string, ttlSec: number): string {
  const secret = getSecret();
  if (!secret) throw new Error("MASTER_SESSION_SECRET is not set");
  const sub = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload: MasterSessionPayload = { sub, exp, pv: passwordVersion(secret) };
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
    typeof payload.exp !== "number" ||
    typeof payload.pv !== "string"
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  // Reject sessions issued under a different (older) password.
  if (payload.pv !== passwordVersion(secret)) return null;

  const expectedEmail = resolvedMasterAdminEmail();
  if (!expectedEmail || payload.sub !== expectedEmail) return null;
  return payload.sub;
}
