/** Nom affiché par défaut de l'application (branding). */
export const APP_DISPLAY_NAME = "Joey & Joey";

/** Initiales affichées dans le logo / favicon. */
export const APP_SHORT_LABEL = "J&J";

export const APP_DESCRIPTION =
  "Gestion commerciale et pré-comptabilité pour PME";

export function getAppDisplayName(nameFromEnv?: string | null): string {
  const trimmed = nameFromEnv?.trim();
  return trimmed || APP_DISPLAY_NAME;
}
