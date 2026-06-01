import { formatCurrency } from "@/lib/pricing";

export function formatDashboardCurrency(amount: number, currency = "EUR"): string {
  return formatCurrency(amount, currency);
}

export function formatPercentage(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function formatDashboardNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function formatChangeBadge(changePercent?: number): {
  text: string;
  variant: "positive" | "negative" | "neutral";
} {
  if (changePercent === undefined || changePercent === 0) {
    return { text: "—", variant: "neutral" };
  }
  return {
    text: formatPercentage(changePercent),
    variant: changePercent > 0 ? "positive" : "negative",
  };
}
