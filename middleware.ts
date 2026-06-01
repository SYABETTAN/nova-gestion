import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, evaluateMiddlewareAccess, getSessionCookieClearOptions } from "@/lib/middleware-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  const decision = await evaluateMiddlewareAccess(pathname, cookieValue);

  if (decision.action === "redirect") {
    const response = NextResponse.redirect(new URL(decision.url, request.url));
    if (decision.clearSession) {
      response.cookies.set(SESSION_COOKIE, "", getSessionCookieClearOptions());
    }
    return response;
  }

  const response = NextResponse.next();
  if (decision.clearSession) {
    response.cookies.set(SESSION_COOKIE, "", getSessionCookieClearOptions());
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|demo).*)"],
};
