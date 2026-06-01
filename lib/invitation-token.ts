import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** 256 bits — non prédictible, URL-safe */
export const INVITATION_TOKEN_BYTES = 32;

/** Durée de validité par défaut (jours) */
export const INVITATION_EXPIRY_DAYS = 7;

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
  return { rawToken, tokenHash: hashInvitationToken(rawToken) };
}

export function invitationTokensMatch(rawToken: string, storedHash: string): boolean {
  const computed = hashInvitationToken(rawToken);
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

export function getInvitationExpiryDate(from = new Date()): Date {
  return new Date(from.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}
