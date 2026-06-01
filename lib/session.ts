import crypto from "crypto";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getSessionCookieClearOptions,
  getSessionCookieOptions,
} from "@/lib/session-cookie";

export { SESSION_COOKIE, SESSION_MAX_AGE, getSessionCookieClearOptions, getSessionCookieOptions };

const DEV_SESSION_SECRET = "development-only-secret-min-32-chars!!";

export type SessionValidationResult =
  | { valid: true; userId: string; issuedAt: number }
  | { valid: false; reason: "missing" | "malformed" | "invalid_signature" | "expired" };

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (process.env.APP_ENV === "production") {
    throw new Error("SESSION_SECRET doit être défini avec une valeur forte en production");
  }
  return DEV_SESSION_SECRET;
}

function signV2(userId: string, issuedAtSec: number): string {
  const payload = `v2.${userId}.${issuedAtSec}`;
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function createSignedSessionValue(userId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const signature = signV2(userId, issuedAt);
  return `v2.${userId}.${issuedAt}.${signature}`;
}

export function validateSessionCookie(
  value: string | undefined | null,
  nowSec = Math.floor(Date.now() / 1000),
): SessionValidationResult {
  if (!value?.trim()) {
    return { valid: false, reason: "missing" };
  }

  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v2") {
    return { valid: false, reason: "malformed" };
  }

  const userId = parts[1];
  const issuedAt = Number(parts[2]);
  const signature = parts[3];

  if (!userId || !signature || !Number.isFinite(issuedAt) || issuedAt <= 0) {
    return { valid: false, reason: "malformed" };
  }

  const expected = signV2(userId, issuedAt);
  if (!timingSafeEqualHex(signature, expected)) {
    return { valid: false, reason: "invalid_signature" };
  }

  if (issuedAt + SESSION_MAX_AGE < nowSec) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, userId, issuedAt };
}

/** @deprecated Utiliser validateSessionCookie */
export function parseSignedSessionValue(value: string | undefined): string | null {
  const result = validateSessionCookie(value);
  return result.valid ? result.userId : null;
}
