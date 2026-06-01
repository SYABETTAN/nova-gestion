import { captureError } from "@/lib/observability/capture-error";

export async function register() {
  if (!process.env.SENTRY_DSN?.trim()) return;

  const moduleName = "@sentry/nextjs";
  try {
    const Sentry = await import(/* webpackIgnore: true */ moduleName);
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.APP_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: process.env.APP_ENV === "production" ? 0.1 : 0.5,
    });
  } catch {
    console.warn("[instrumentation] SENTRY_DSN défini mais @sentry/nextjs non installé");
  }
}

export function onRequestError(
  error: Error,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string },
) {
  captureError(error, {
    area: "request",
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
  });
}
