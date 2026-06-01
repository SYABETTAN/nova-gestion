import { isProduction, isStaging } from "@/lib/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, string | number | boolean | null | undefined>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const fromEnv = process.env.LOG_LEVEL?.toLowerCase();
  if (fromEnv === "debug" || fromEnv === "info" || fromEnv === "warn" || fromEnv === "error") {
    return fromEnv;
  }
  if (isProduction() || isStaging()) return "info";
  return "debug";
}

let minLevel: LogLevel | null = null;

function shouldLog(level: LogLevel): boolean {
  if (!minLevel) minLevel = resolveMinLevel();
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function sanitizeContext(ctx?: LogContext): LogContext | undefined {
  if (!ctx) return undefined;
  const sensitive = /password|secret|token|authorization|cookie|api[_-]?key/i;
  const out: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (sensitive.test(key)) {
      out[key] = "[redacted]";
    } else if (typeof value === "string" && value.length > 500) {
      out[key] = `${value.slice(0, 500)}…`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function write(level: LogLevel, message: string, ctx?: LogContext, err?: unknown) {
  if (!shouldLog(level)) return;

  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    message,
    env: process.env.APP_ENV ?? process.env.NODE_ENV,
    ...(sanitizeContext(ctx) ?? {}),
  };

  if (err instanceof Error) {
    payload.error = err.name;
    payload.errorMessage = err.message;
    if (!isProduction()) payload.stack = err.stack;
  }

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, ctx?: LogContext) => write("debug", message, ctx),
  info: (message: string, ctx?: LogContext) => write("info", message, ctx),
  warn: (message: string, ctx?: LogContext) => write("warn", message, ctx),
  error: (message: string, ctx?: LogContext, err?: unknown) =>
    write("error", message, ctx, err),
};
