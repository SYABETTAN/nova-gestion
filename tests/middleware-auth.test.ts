import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_MAX_AGE, createSignedSessionValue } from "@/lib/session";
import { validateSessionCookie as validateSessionCookieEdge } from "@/lib/session-edge";
import { evaluateMiddlewareAccess, isPublicPath } from "@/lib/middleware-auth";

describe("middleware auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function validCookie(userId = "user-1") {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    return createSignedSessionValue(userId);
  }

  it("Edge valide un cookie signé côté Node", async () => {
    const cookie = validCookie();
    const result = await validateSessionCookieEdge(cookie);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.userId).toBe("user-1");
    }
  });

  it("identifie les routes publiques", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/accept-invitation/abc")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
  });

  it("redirige une route privée sans cookie vers login", async () => {
    const decision = await evaluateMiddlewareAccess("/dashboard", undefined);
    expect(decision).toEqual({ action: "redirect", url: "/login", clearSession: false });
  });

  it("redirige une route privée avec cookie invalide et le supprime", async () => {
    const decision = await evaluateMiddlewareAccess("/invoices", "invalid-cookie");
    expect(decision).toEqual({ action: "redirect", url: "/login", clearSession: true });
  });

  it("redirige une route privée avec signature invalide", async () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    const cookie = `${createSignedSessionValue("user-1")}x`;
    const decision = await evaluateMiddlewareAccess("/customers", cookie);
    expect(decision.action).toBe("redirect");
    if (decision.action === "redirect") {
      expect(decision.url).toBe("/login");
      expect(decision.clearSession).toBe(true);
    }
  });

  it("redirige une route privée avec session expirée", async () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    const cookie = createSignedSessionValue("user-1");
    const nowSec = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE + 10;
    const decision = await evaluateMiddlewareAccess("/dashboard", cookie, nowSec);
    expect(decision.action).toBe("redirect");
    if (decision.action === "redirect") {
      expect(decision.clearSession).toBe(true);
    }
  });

  it("autorise une route privée avec session valide", async () => {
    const cookie = validCookie();
    expect(await evaluateMiddlewareAccess("/dashboard", cookie)).toEqual({ action: "next" });
  });

  it("redirige login vers dashboard si session valide", async () => {
    const cookie = validCookie();
    const decision = await evaluateMiddlewareAccess("/login", cookie);
    expect(decision).toEqual({ action: "redirect", url: "/dashboard" });
  });

  it("laisse register accessible sans session", async () => {
    expect(await evaluateMiddlewareAccess("/register", undefined)).toEqual({
      action: "next",
      clearSession: false,
    });
  });

  it("laisse accept-invitation accessible sans session", async () => {
    expect(await evaluateMiddlewareAccess("/accept-invitation/token", undefined)).toEqual({
      action: "next",
      clearSession: false,
    });
  });

  it("nettoie un cookie invalide sur route publique sans boucle", async () => {
    const decision = await evaluateMiddlewareAccess("/login", "bad-cookie");
    expect(decision).toEqual({ action: "next", clearSession: true });
  });

  it("évite une boucle login/dashboard avec cookie expiré", async () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    const cookie = createSignedSessionValue("user-1");
    const nowSec = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE + 5;
    const loginDecision = await evaluateMiddlewareAccess("/login", cookie, nowSec);
    expect(loginDecision).toEqual({ action: "next", clearSession: true });
  });
});
