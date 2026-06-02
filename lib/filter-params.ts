/** Valeur sentinelle pour les champs optionnels des formulaires GET (jamais appliquée en requête). */
export function normalizeFilterSearchParams(
  params: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const trimmed = String(value).trim();
    if (trimmed !== "") out[key] = trimmed;
  }
  return out;
}

/** Indique si un paramètre de filtre doit être appliqué (ignore chaînes vides). */
export function hasFilterValue(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
