import {
  SESSION_COOKIE,
  getSessionCookieClearOptions,
} from "@/lib/session-cookie";
import { validateSessionCookie } from "@/lib/session-edge";

export { SESSION_COOKIE };

export const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/accept-invitation"] as const;

export const AUTH_ONLY_EXACT_PATHS = ["/login", "/register"] as const;

export type MiddlewareDecision =
  | { action: "next"; clearSession?: boolean }
  | { action: "redirect"; url: string; clearSession?: boolean };

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    pathname.startsWith("/demo")
  );
}

export function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_EXACT_PATHS.includes(pathname as (typeof AUTH_ONLY_EXACT_PATHS)[number]);
}

export function shouldSkipMiddleware(pathname: string): boolean {
  return pathname.startsWith("/_next");
}

export async function evaluateMiddlewareAccess(
  pathname: string,
  cookieValue: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<MiddlewareDecision> {
  if (shouldSkipMiddleware(pathname)) {
    return { action: "next" };
  }

  const hasCookie = Boolean(cookieValue?.trim());
  const session = hasCookie
    ? await validateSessionCookie(cookieValue, nowSec)
    : { valid: false as const, reason: "missing" as const };
  const isPublic = isPublicPath(pathname);

  if (session.valid) {
    if (isAuthOnlyPath(pathname)) {
      return { action: "redirect", url: "/dashboard" };
    }
    return { action: "next" };
  }

  if (isPublic) {
    return { action: "next", clearSession: hasCookie };
  }

  return { action: "redirect", url: "/login", clearSession: hasCookie };
}

export { getSessionCookieClearOptions };
