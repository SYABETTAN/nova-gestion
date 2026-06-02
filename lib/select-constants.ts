/** Valeur Radix/shadcn pour « aucune sélection » (ne jamais utiliser value="" sur SelectItem). */
export const SELECT_NONE = "none";

export function optionalSelectId(value: string | null | undefined): string {
  if (!value) return SELECT_NONE;
  return value;
}

export function selectIdToOptional(value: string): string | null {
  if (!value || value === SELECT_NONE) return null;
  return value;
}

export function emptyFormValueToNull(value?: string | null): string | null {
  if (!value || value === SELECT_NONE) return null;
  return value;
}
