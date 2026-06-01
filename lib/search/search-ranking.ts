import type { SearchResult } from "@/lib/search/search-types";
import { normalizeSearchQuery } from "@/lib/search/search-utils";

const EXACT_NUMBER_FIELDS = [
  "invoiceNumber",
  "quoteNumber",
  "customerNumber",
  "supplierNumber",
  "paymentNumber",
  "entryNumber",
  "reminderNumber",
  "supplierInvoiceNumber",
  "itemNumber",
];

export function rankSearchResult(
  result: SearchResult,
  query: string,
  options?: { isFavorite?: boolean; isRecent?: boolean },
): number {
  const q = normalizeSearchQuery(query);
  if (!q) return result.score;

  let score = result.score;
  const titleNorm = normalizeSearchQuery(result.title);
  const numberField = result.metadata?.numberField as string | undefined;
  const numberValue = result.metadata?.numberValue as string | undefined;

  if (numberValue && normalizeSearchQuery(numberValue) === q) {
    score += 100;
  }
  if (numberField && EXACT_NUMBER_FIELDS.includes(numberField) && titleNorm === q) {
    score += 100;
  }
  if (titleNorm.startsWith(q)) score += 80;
  else if (titleNorm.includes(q)) score += 60;

  const subtitle = result.subtitle ? normalizeSearchQuery(result.subtitle) : "";
  if (subtitle.includes(q)) score += 40;

  const description = result.description ? normalizeSearchQuery(result.description) : "";
  if (description.includes(q)) score += 30;

  if (result.status && normalizeSearchQuery(result.status).includes(q)) score += 20;

  if (options?.isRecent) score += 10;
  if (options?.isFavorite) score += 10;

  return score;
}

export function sortSearchResults(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => b.score - a.score);
}

export function applyRanking(
  results: SearchResult[],
  query: string,
  favoriteKeys: Set<string>,
): SearchResult[] {
  return sortSearchResults(
    results.map((r) => ({
      ...r,
      score: rankSearchResult(r, query, {
        isFavorite: favoriteKeys.has(`${r.type}:${r.id}`),
      }),
      isFavorite: favoriteKeys.has(`${r.type}:${r.id}`),
    })),
  );
}
