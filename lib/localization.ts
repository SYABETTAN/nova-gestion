import { formatLocalizationPreview } from "@/lib/settings-utils";

export const DEFAULT_LOCALIZATION = {
  locale: "fr-FR",
  timezone: "Europe/Paris",
  dateFormat: "dd/MM/yyyy",
  numberFormat: "fr-FR",
  currencyFormat: "fr-FR",
  firstDayOfWeek: "MONDAY",
} as const;

export function getDefaultLocalization() {
  return { ...DEFAULT_LOCALIZATION };
}

export function previewLocalization(locale: string, dateFormat: string) {
  return formatLocalizationPreview(locale, dateFormat);
}
