import { isProduction } from "@/lib/env";
import { APP_DISPLAY_NAME } from "@/lib/branding";
import type { EmailConfig, EmailProviderName } from "@/lib/email/types";

export const EMAIL_NOT_CONFIGURED_ERROR =
  "L'envoi par email n'est pas configuré. Définissez EMAIL_PROVIDER, EMAIL_FROM et les clés du provider (ex. RESEND_API_KEY).";

function resolveDefaultProvider(): EmailProviderName {
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return "mock";
  }
  if (isProduction()) {
    return (process.env.EMAIL_PROVIDER as EmailProviderName) || "resend";
  }
  return (process.env.EMAIL_PROVIDER as EmailProviderName) || "log";
}

export function getEmailConfig(): EmailConfig {
  const provider = resolveDefaultProvider();
  const from = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || undefined;

  if (isProduction()) {
    if (!from) {
      throw new Error(`${EMAIL_NOT_CONFIGURED_ERROR} (EMAIL_FROM manquant)`);
    }
    if (provider === "resend" && !resendApiKey) {
      throw new Error(`${EMAIL_NOT_CONFIGURED_ERROR} (RESEND_API_KEY manquant)`);
    }
    if (provider === "log" || provider === "mock") {
      throw new Error(`${EMAIL_NOT_CONFIGURED_ERROR} (provider ${provider} interdit en production)`);
    }
  }

  return {
    provider,
    from: from || `${APP_DISPLAY_NAME} <no-reply@localhost.dev>`,
    replyTo,
    resendApiKey,
  };
}

export function isEmailConfigured(): boolean {
  try {
    getEmailConfig();
    if (isProduction()) {
      const provider = process.env.EMAIL_PROVIDER || "resend";
      const from = process.env.EMAIL_FROM?.trim();
      if (!from) return false;
      if (provider === "resend" && !process.env.RESEND_API_KEY?.trim()) return false;
      return provider === "resend";
    }
    return true;
  } catch {
    return false;
  }
}
