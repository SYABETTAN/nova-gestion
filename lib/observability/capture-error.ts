import { logger } from "@/lib/observability/logger";

export type ErrorCaptureContext = {
  area: string;
  userId?: string;
  organizationId?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: string | undefined;
};

/**
 * Point central pour tracer les erreurs serveur.
 * Si SENTRY_DSN est défini et @sentry/nextjs installé, l'erreur est aussi envoyée à Sentry.
 */
export function captureError(error: unknown, context: ErrorCaptureContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  logger.error(`[${context.area}] ${err.message}`, context, err);

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  // Package optionnel — ne pas résoudre au build si absent
  const moduleName = "@sentry/nextjs";
  void import(/* webpackIgnore: true */ moduleName)
    .then((Sentry: { captureException: typeof import("@sentry/nextjs").captureException }) => {
      Sentry.captureException(err, {
        tags: { area: context.area },
        extra: context,
      });
    })
    .catch(() => undefined);
}
