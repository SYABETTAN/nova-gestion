/** Constantes et options cookie — sans dépendance Node (utilisable en Edge). */

export const SESSION_COOKIE = "esther_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function getSessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

export function getSessionCookieClearOptions() {
  return getSessionCookieOptions(0);
}
