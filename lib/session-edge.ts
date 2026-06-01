/**
 * Validation de session compatible Edge (middleware Vercel).
 * Même algorithme que lib/session.ts (HMAC-SHA256 v2).
 */
import { SESSION_MAX_AGE } from "@/lib/session-cookie";

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

function bufferToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signV2(userId: string, issuedAtSec: number): Promise<string> {
  const secret = getSessionSecret();
  const payload = `v2.${userId}.${issuedAtSec}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bufferToHex(new Uint8Array(sig));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function validateSessionCookie(
  value: string | undefined | null,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<SessionValidationResult> {
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

  const expected = await signV2(userId, issuedAt);
  if (!timingSafeEqualHex(signature, expected)) {
    return { valid: false, reason: "invalid_signature" };
  }

  if (issuedAt + SESSION_MAX_AGE < nowSec) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, userId, issuedAt };
}
