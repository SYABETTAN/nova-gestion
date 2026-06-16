import type { SearchEntityType } from "@prisma/client";

const SEARCH_ENTITY_TYPES = new Set<string>([
  "CUSTOMER",
  "ITEM",
  "QUOTE",
  "INVOICE",
  "PAYMENT",
  "REMINDER",
  "SUPPLIER",
  "SUPPLIER_INVOICE",
  "ACCOUNTING_ENTRY",
  "DOCUMENT",
  "EXPORT_JOB",
  "SETTING",
  "AUDIT_LOG",
]);

export function normalizeSearchQuery(query: string): string {
  return query
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function highlightMatch(text: string, query: string): string {
  const q = normalizeSearchQuery(query);
  if (!q || !text) return text;
  const idx = normalizeSearchQuery(text).indexOf(q);
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return `${before}«${match}»${after}`;
}

export function favoriteKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function isQueryLongEnough(query: string, min = 2): boolean {
  return normalizeSearchQuery(query).length >= min;
}

export function parseSearchEntityType(value?: string | null): SearchEntityType | null {
  if (!value || value === "all") return null;
  if (SEARCH_ENTITY_TYPES.has(value)) return value as SearchEntityType;
  return null;
}

export function buildPrismaContains(query: string): string {
  return query.trim();
}

export function findExactMatch<T extends { title: string; metadata?: Record<string, unknown> }>(
  results: T[],
  query: string,
): T | undefined {
  const q = normalizeSearchQuery(query);
  return results.find((r) => {
    const num = r.metadata?.numberValue as string | undefined;
    if (num && normalizeSearchQuery(num) === q) return true;
    return normalizeSearchQuery(r.title) === q;
  });
}
