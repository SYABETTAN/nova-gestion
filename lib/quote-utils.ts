import type { Quote, QuoteStatus } from "@prisma/client";
import { formatQuoteStatus } from "@/lib/quote-status";
import { moneyAdd, moneyToNumber } from "@/lib/money";

export function formatQuoteNumber(quoteNumber: string): string {
  return quoteNumber;
}

export function parseQuoteLinesJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function computeQuoteStats(
  quotes: Pick<Quote, "status" | "totalIncludingTax" | "isArchived">[],
) {
  const active = quotes.filter((q) => !q.isArchived);
  const drafts = active.filter((q) => q.status === "DRAFT").length;
  const sent = active.filter((q) => q.status === "SENT" || q.status === "VIEWED").length;
  const accepted = active.filter((q) => q.status === "ACCEPTED").length;
  const expired = active.filter((q) => q.status === "EXPIRED").length;
  const acceptedAmount = moneyToNumber(
    active
      .filter((q) => q.status === "ACCEPTED" || q.status === "CONVERTED")
      .reduce((sum, q) => moneyAdd(sum, q.totalIncludingTax), moneyAdd(0, 0)),
  );
  const pendingAmount = moneyToNumber(
    active
      .filter((q) => q.status === "SENT" || q.status === "VIEWED")
      .reduce((sum, q) => moneyAdd(sum, q.totalIncludingTax), moneyAdd(0, 0)),
  );
  const sentCount = active.filter((q) => q.status === "SENT" || q.status === "VIEWED").length;
  const decidedCount = active.filter((q) =>
    ["ACCEPTED", "REFUSED", "EXPIRED", "CONVERTED"].includes(q.status),
  ).length;
  const acceptanceRate =
    decidedCount > 0
      ? Math.round((accepted / decidedCount) * 100)
      : 0;
  const averageBasket =
    accepted > 0 ? acceptedAmount / accepted : 0;

  return {
    total: active.length,
    drafts,
    sent,
    accepted,
    expired,
    acceptedAmount,
    pendingAmount,
    acceptanceRate,
    averageBasket,
  };
}

export const QUOTE_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CREATED: "Devis créé",
  UPDATED: "Devis modifié",
  SENT: "Devis envoyé",
  VIEWED: "Devis consulté",
  ACCEPTED: "Devis accepté",
  REFUSED: "Devis refusé",
  EXPIRED: "Devis expiré",
  CANCELLED: "Devis annulé",
  CONVERTED: "Converti en facture",
  DUPLICATED: "Devis dupliqué",
  PDF_GENERATED: "PDF généré",
  EMAIL_SIMULATED: "Notification email",
  NOTE: "Note ajoutée",
};

export function getDefaultValidUntil(issueDate: Date, days = 30): Date {
  const result = new Date(issueDate);
  result.setDate(result.getDate() + days);
  return result;
}

export function statusFilterLabel(status: QuoteStatus): string {
  return formatQuoteStatus(status);
}
