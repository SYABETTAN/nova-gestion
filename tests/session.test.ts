import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_MAX_AGE,
  createSignedSessionValue,
  validateSessionCookie,
} from "@/lib/session";

describe("session v2", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepte une session valide avec signature correcte", () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    const value = createSignedSessionValue("user-abc");
    const result = validateSessionCookie(value);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.userId).toBe("user-abc");
    }
  });

  it("refuse une signature invalide", () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    const value = createSignedSessionValue("user-abc");
    const last = value[value.length - 1]!;
    const flipped = last === "a" ? "b" : "a";
    const tampered = `${value.slice(0, -1)}${flipped}`;
    const result = validateSessionCookie(tampered);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("invalid_signature");
  });

  it("refuse un cookie malformé", () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    expect(validateSessionCookie("not-a-valid-session").valid).toBe(false);
    expect(validateSessionCookie("v2.only.two").valid).toBe(false);
    const missing = validateSessionCookie(undefined);
    expect(missing.valid).toBe(false);
    if (!missing.valid) expect(missing.reason).toBe("missing");
  });

  it("refuse une session expirée", () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    const value = createSignedSessionValue("user-expired");
    const nowSec = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE + 60;
    const result = validateSessionCookie(value, nowSec);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("expired");
  });

  it("refuse l'ancien format de cookie sans expiration", () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    const legacy = "cluser123.deadbeef";
    const result = validateSessionCookie(legacy);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("malformed");
  });
});
