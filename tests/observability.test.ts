import { afterEach, describe, expect, it, vi } from "vitest";

describe("observability logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("masque les champs sensibles dans les logs", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { logger } = await import("@/lib/observability/logger");
    logger.info("test event", {
      userId: "u1",
      password: "secret123",
      sessionToken: "abc",
    });

    expect(spy).toHaveBeenCalled();
    const line = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.password).toBe("[redacted]");
    expect(parsed.sessionToken).toBe("[redacted]");
    expect(parsed.userId).toBe("u1");
  });
});

describe("verify-deployment script", () => {
  it("documente les garde-fous production dans le script", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("scripts/verify-deployment.ts", "utf-8");
    expect(content).toContain("SEED_DEV_DATA");
    expect(content).toContain("ENABLE_DEV_LOGIN");
    expect(content).toContain("db:migrate:deploy");
  });
});
