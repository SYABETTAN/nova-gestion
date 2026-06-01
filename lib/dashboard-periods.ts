import type { DashboardPeriodPreset, DateRange } from "@/lib/dashboard-types";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function getDateRangeFromPreset(
  preset: DashboardPeriodPreset,
  customStart?: Date,
  customEnd?: Date,
): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case "THIS_MONTH":
      return {
        preset,
        startDate: startOfDay(new Date(year, month, 1)),
        endDate: endOfDay(new Date(year, month + 1, 0)),
      };
    case "LAST_MONTH": {
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      return {
        preset,
        startDate: startOfDay(new Date(y, m, 1)),
        endDate: endOfDay(new Date(y, m + 1, 0)),
      };
    }
    case "THIS_QUARTER": {
      const qStart = Math.floor(month / 3) * 3;
      return {
        preset,
        startDate: startOfDay(new Date(year, qStart, 1)),
        endDate: endOfDay(new Date(year, qStart + 3, 0)),
      };
    }
    case "LAST_QUARTER": {
      const qStart = Math.floor(month / 3) * 3 - 3;
      const y = qStart < 0 ? year - 1 : year;
      const qs = qStart < 0 ? qStart + 12 : qStart;
      return {
        preset,
        startDate: startOfDay(new Date(y, qs, 1)),
        endDate: endOfDay(new Date(y, qs + 3, 0)),
      };
    }
    case "THIS_YEAR":
      return {
        preset,
        startDate: startOfDay(new Date(year, 0, 1)),
        endDate: endOfDay(new Date(year, 11, 31)),
      };
    case "LAST_12_MONTHS":
      return {
        preset,
        startDate: startOfDay(new Date(year, month - 11, 1)),
        endDate: endOfDay(now),
      };
    case "CUSTOM":
      if (!customStart || !customEnd) {
        return getDateRangeFromPreset("THIS_MONTH");
      }
      return {
        preset,
        startDate: startOfDay(customStart),
        endDate: endOfDay(customEnd),
      };
    default:
      return getDateRangeFromPreset("THIS_MONTH");
  }
}

export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  const t = date.getTime();
  return t >= startDate.getTime() && t <= endDate.getTime();
}

export function formatPeriodLabel(range: DateRange): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const labels: Record<DashboardPeriodPreset, string> = {
    THIS_MONTH: "Ce mois",
    LAST_MONTH: "Mois précédent",
    THIS_QUARTER: "Ce trimestre",
    LAST_QUARTER: "Trimestre précédent",
    THIS_YEAR: "Cette année",
    LAST_12_MONTHS: "12 derniers mois",
    CUSTOM: `${fmt.format(range.startDate)} — ${fmt.format(range.endDate)}`,
  };
  return labels[range.preset] ?? labels.CUSTOM;
}

export function getPreviousPeriodRange(range: DateRange): DateRange {
  const duration = range.endDate.getTime() - range.startDate.getTime();
  const end = new Date(range.startDate.getTime() - 1);
  const start = new Date(end.getTime() - duration);
  return {
    preset: range.preset,
    startDate: startOfDay(start),
    endDate: endOfDay(end),
  };
}

export const PERIOD_PRESET_LABELS: Record<DashboardPeriodPreset, string> = {
  THIS_MONTH: "Ce mois",
  LAST_MONTH: "Mois précédent",
  THIS_QUARTER: "Ce trimestre",
  LAST_QUARTER: "Trimestre précédent",
  THIS_YEAR: "Cette année",
  LAST_12_MONTHS: "12 derniers mois",
  CUSTOM: "Personnalisé",
};
