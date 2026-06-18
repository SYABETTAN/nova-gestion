import { z } from "zod";

const DEV_SESSION_SECRET = "development-only-secret-min-32-chars!!";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET doit contenir au moins 32 caractères")
    .default(DEV_SESSION_SECRET),
  NEXT_PUBLIC_APP_NAME: z.string().default("Joey & Joey"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  SEED_DEV_DATA: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  ENABLE_DEV_LOGIN: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  REGISTRATION_MODE: z
    .enum(["closed", "invite_only", "email_verification", "open_dev"])
    .optional(),
  ALLOW_PUBLIC_SIGNUP: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  REQUIRE_EMAIL_VERIFICATION: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type AppEnv = z.infer<typeof envSchema>;

function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Configuration environnement invalide:\n${message}`);
  }
  const env = parsed.data;

  if (env.APP_ENV === "production") {
    if (env.SESSION_SECRET === DEV_SESSION_SECRET) {
      throw new Error("SESSION_SECRET doit être défini avec une valeur forte en production");
    }
    if (env.SEED_DEV_DATA) {
      throw new Error("SEED_DEV_DATA ne doit pas être activé en production");
    }
    if (env.ENABLE_DEV_LOGIN) {
      throw new Error("ENABLE_DEV_LOGIN ne doit pas être activé en production");
    }

    const registrationMode =
      env.REGISTRATION_MODE ?? (env.ALLOW_PUBLIC_SIGNUP ? "open_dev" : "invite_only");

    if (registrationMode === "email_verification") {
      throw new Error(
        "REGISTRATION_MODE=email_verification n'est pas encore implémenté en production",
      );
    }

    if (registrationMode === "open_dev" && !env.ALLOW_PUBLIC_SIGNUP) {
      throw new Error(
        "En production, REGISTRATION_MODE=open_dev requiert ALLOW_PUBLIC_SIGNUP=true (onboarding temporaire uniquement).",
      );
    }

    if (env.ALLOW_PUBLIC_SIGNUP && registrationMode !== "open_dev") {
      throw new Error(
        "ALLOW_PUBLIC_SIGNUP=true n'est valide qu'avec REGISTRATION_MODE=open_dev.",
      );
    }

    if (env.ALLOW_PUBLIC_SIGNUP) {
      console.warn(
        "[env] ALLOW_PUBLIC_SIGNUP=true en production — inscription OWNER ouverte (désactivez après onboarding).",
      );
    }

    if (env.REQUIRE_EMAIL_VERIFICATION) {
      throw new Error("REQUIRE_EMAIL_VERIFICATION n'est pas encore implémenté.");
    }
  }

  return env;
}

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) cached = loadEnv();
  return cached;
}

export function isProduction(): boolean {
  return getEnv().APP_ENV === "production";
}

export function isStaging(): boolean {
  return getEnv().APP_ENV === "staging";
}

export function isDevelopment(): boolean {
  return getEnv().APP_ENV === "development";
}

export function devDataEnabled(): boolean {
  return getEnv().SEED_DEV_DATA && !isProduction();
}

export function devLoginEnabled(): boolean {
  return getEnv().ENABLE_DEV_LOGIN && !isProduction();
}
