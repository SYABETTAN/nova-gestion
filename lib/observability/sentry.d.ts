/** Types minimales si @sentry/nextjs n'est pas installé (monitoring optionnel). */
declare module "@sentry/nextjs" {
  export function init(options: {
    dsn?: string;
    environment?: string;
    tracesSampleRate?: number;
  }): void;
  export function captureException(
    error: Error,
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
  ): void;
}
