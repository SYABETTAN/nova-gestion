import { APP_DISPLAY_NAME } from "@/lib/branding";
import { getEnv, isProduction } from "@/lib/env";

export type RegistrationMode = "closed" | "invite_only" | "email_verification" | "open_dev";

export const REGISTRATION_MESSAGES = {
  inviteOnly:
    "Les inscriptions sont actuellement disponibles sur invitation. Rejoignez une organisation via le lien reçu par email, ou contactez l'équipe pour activer votre espace.",
  closed:
    `Les inscriptions publiques sont fermées. Contactez l'équipe ${APP_DISPLAY_NAME} pour activer votre espace.`,
  emailVerification:
    "La vérification email à l'inscription n'est pas encore disponible. Contactez l'équipe pour activer votre espace.",
} as const;

function resolveRegistrationMode(): RegistrationMode {
  const env = getEnv();

  if (env.REGISTRATION_MODE) {
    return env.REGISTRATION_MODE;
  }

  if (env.ALLOW_PUBLIC_SIGNUP) {
    return "open_dev";
  }

  if (isProduction()) {
    return "invite_only";
  }

  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return "open_dev";
  }

  return "open_dev";
}

export function getRegistrationMode(): RegistrationMode {
  return resolveRegistrationMode();
}

export function isPublicOrganizationSignupAllowed(): boolean {
  return getRegistrationMode() === "open_dev";
}

export function getPublicSignupBlockReason(): string | null {
  if (isPublicOrganizationSignupAllowed()) {
    return null;
  }

  switch (getRegistrationMode()) {
    case "invite_only":
      return REGISTRATION_MESSAGES.inviteOnly;
    case "closed":
      return REGISTRATION_MESSAGES.closed;
    case "email_verification":
      return REGISTRATION_MESSAGES.emailVerification;
    default:
      return REGISTRATION_MESSAGES.closed;
  }
}

export function assertPublicOrganizationSignupAllowed():
  | { allowed: true }
  | { allowed: false; error: string } {
  const reason = getPublicSignupBlockReason();
  if (reason) {
    return { allowed: false, error: reason };
  }
  return { allowed: true };
}

export function getPublicSignupStatus() {
  const mode = getRegistrationMode();
  const allowed = mode === "open_dev";
  return {
    allowed,
    mode,
    message: getPublicSignupBlockReason(),
  };
}
