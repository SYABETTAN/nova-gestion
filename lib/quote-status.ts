import type { QuoteStatus } from "@prisma/client";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  VIEWED: "Vu",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
  CANCELLED: "Annulé",
  CONVERTED: "Converti",
};

export const QUOTE_STATUS_VARIANTS: Record<
  QuoteStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  SENT: "default",
  VIEWED: "default",
  ACCEPTED: "success",
  REFUSED: "destructive",
  EXPIRED: "warning",
  CANCELLED: "outline",
  CONVERTED: "success",
};

export function formatQuoteStatus(status: QuoteStatus): string {
  return QUOTE_STATUS_LABELS[status] ?? status;
}

export function isQuoteEditable(status: QuoteStatus): boolean {
  return status === "DRAFT" || status === "SENT" || status === "VIEWED";
}

export function isQuoteEditableWithConfirmation(status: QuoteStatus): boolean {
  return status === "SENT" || status === "VIEWED";
}

export function isQuoteExpired(validUntil: Date, now: Date = new Date()): boolean {
  const end = new Date(validUntil);
  end.setHours(23, 59, 59, 999);
  return now > end;
}

export function canAcceptQuote(status: QuoteStatus): boolean {
  return status === "SENT" || status === "VIEWED";
}

export function canRefuseQuote(status: QuoteStatus): boolean {
  return status === "SENT" || status === "VIEWED";
}

export function canConvertQuote(status: QuoteStatus): boolean {
  return status === "ACCEPTED";
}

export function canSendQuote(status: QuoteStatus): boolean {
  return status === "DRAFT" || status === "SENT" || status === "VIEWED";
}

export function canCancelQuote(status: QuoteStatus): boolean {
  return status === "DRAFT" || status === "SENT" || status === "VIEWED";
}

export function canMarkViewed(status: QuoteStatus): boolean {
  return status === "SENT";
}

export function canExpireQuote(status: QuoteStatus): boolean {
  return status === "SENT" || status === "VIEWED";
}

export function canDuplicateQuote(_status: QuoteStatus): boolean {
  return true;
}
