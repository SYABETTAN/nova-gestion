import type { InvoicePaymentStatus, InvoiceStatus } from "@prisma/client";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validée",
  SENT: "Envoyée",
  OVERDUE: "En retard",
  PAID: "Payée",
  PARTIALLY_PAID: "Partiellement payée",
  CANCELLED: "Annulée",
  CREDITED: "Créditée",
};

export const INVOICE_PAYMENT_STATUS_LABELS: Record<InvoicePaymentStatus, string> = {
  UNPAID: "Impayée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
};

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  DEPOSIT: "Acompte",
  FINAL: "Finale",
  CREDITED_REFERENCE: "Réf. créditée",
};

export function formatInvoiceStatus(status: InvoiceStatus): string {
  return INVOICE_STATUS_LABELS[status] ?? status;
}

export function formatPaymentStatus(status: InvoicePaymentStatus): string {
  return INVOICE_PAYMENT_STATUS_LABELS[status] ?? status;
}

export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "DRAFT";
}

export function isInvoiceOverdue(
  dueDate: Date,
  paymentStatus: InvoicePaymentStatus,
  now: Date = new Date(),
): boolean {
  if (paymentStatus === "PAID") return false;
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  return now > end;
}

export function canValidateInvoice(status: InvoiceStatus): boolean {
  return status === "DRAFT";
}

export function canSendInvoice(status: InvoiceStatus): boolean {
  return status === "VALIDATED" || status === "SENT";
}

export function canMarkPaid(status: InvoiceStatus): boolean {
  return ["VALIDATED", "SENT", "OVERDUE", "PARTIALLY_PAID"].includes(status);
}

export function canMarkPartiallyPaid(status: InvoiceStatus): boolean {
  return ["VALIDATED", "SENT", "OVERDUE", "PARTIALLY_PAID"].includes(status);
}

export function canMarkOverdue(status: InvoiceStatus): boolean {
  return status === "SENT" || status === "VALIDATED";
}

export function canCancelInvoice(status: InvoiceStatus): boolean {
  return ["DRAFT", "VALIDATED", "SENT"].includes(status);
}

export function canCreateCreditNote(status: InvoiceStatus): boolean {
  return ["VALIDATED", "SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"].includes(status);
}

export function canDuplicateInvoice(_status: InvoiceStatus): boolean {
  return true;
}
