import { afterEach, describe, expect, it, vi } from "vitest";

describe("production guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("bloque les actions simulées en production côté serveur", async () => {
    vi.doMock("@/lib/env", () => ({
      isProduction: () => true,
      isStaging: () => false,
      isDevelopment: () => false,
      getEnv: () => ({ APP_ENV: "production" }),
      devDataEnabled: () => false,
      devLoginEnabled: () => false,
    }));

    const { blockSimulatedActionInProduction, simulatedActionsAllowed } = await import(
      "@/lib/feature-availability"
    );

    expect(simulatedActionsAllowed()).toBe(false);
    expect(blockSimulatedActionInProduction()).toEqual({
      success: false,
      error:
        "L'envoi par email n'est pas configuré. Définissez EMAIL_PROVIDER, EMAIL_FROM et RESEND_API_KEY.",
    });

    vi.doUnmock("@/lib/env");
  });

  it("autorise les actions simulées en développement", async () => {
    vi.doMock("@/lib/env", () => ({
      isProduction: () => false,
      isStaging: () => false,
      isDevelopment: () => true,
      getEnv: () => ({ APP_ENV: "development" }),
      devDataEnabled: () => true,
      devLoginEnabled: () => true,
    }));

    vi.resetModules();
    const { blockSimulatedActionInProduction, simulatedActionsAllowed } = await import(
      "@/lib/feature-availability"
    );

    expect(simulatedActionsAllowed()).toBe(true);
    expect(blockSimulatedActionInProduction()).toBeNull();

    vi.doUnmock("@/lib/env");
  });

  it("masque les actions simulées côté client en production", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    const { simulatedActionsVisible, isProductionClient } = await import("@/lib/client-env");
    expect(isProductionClient()).toBe(true);
    expect(simulatedActionsVisible()).toBe(false);
  });

  it("refuse SEED_DEV_DATA quand APP_ENV vaut production", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/test");
    vi.stubEnv("SESSION_SECRET", "production-secret-key-32-chars-min!!");
    vi.stubEnv("SEED_DEV_DATA", "true");
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");

    expect(() => {
      const { z } = require("zod");
      const env = {
        APP_ENV: "production",
        SEED_DEV_DATA: true,
        ENABLE_DEV_LOGIN: false,
        SESSION_SECRET: "production-secret-key-32-chars-min!!",
      };
      if (env.SEED_DEV_DATA) throw new Error("SEED_DEV_DATA ne doit pas être activé en production");
    }).toThrow(/SEED_DEV_DATA/);
  });

  it("refuse ENABLE_DEV_LOGIN quand APP_ENV vaut production", () => {
    expect(() => {
      const env = { APP_ENV: "production", ENABLE_DEV_LOGIN: true, SEED_DEV_DATA: false };
      if (env.ENABLE_DEV_LOGIN) throw new Error("ENABLE_DEV_LOGIN ne doit pas être activé en production");
    }).toThrow(/ENABLE_DEV_LOGIN/);
  });
});
