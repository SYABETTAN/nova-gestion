import type {
  SupplierInvoicePaymentStatus,
  SupplierInvoiceStatus,
} from "@prisma/client";
import { isPositive, isZero, moneySub, moneyToNumber, type MoneyInput } from "@/lib/money";

export const SUPPLIER_INVOICE_STATUS_LABELS: Record<SupplierInvoiceStatus, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validée",
  CANCELLED: "Annulée",
  ARCHIVED: "Archivée",
};

export const SUPPLIER_INVOICE_PAYMENT_STATUS_LABELS: Record<SupplierInvoicePaymentStatus, string> = {
  UNPAID: "Non payée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
};

export const SUPPLIER_INVOICE_TYPE_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  CREDIT_NOTE: "Avoir",
  DEPOSIT: "Acompte",
  OTHER: "Autre",
};

export function isSupplierInvoiceEditable(status: SupplierInvoiceStatus): boolean {
  return status === "DRAFT";
}

export function canValidateSupplierInvoice(status: SupplierInvoiceStatus): boolean {
  return status === "DRAFT";
}

export function canCancelSupplierInvoice(status: SupplierInvoiceStatus): boolean {
  return status !== "CANCELLED";
}

export function canMarkSupplierInvoicePaid(status: SupplierInvoiceStatus): boolean {
  return status === "VALIDATED";
}

export function canMarkSupplierInvoicePartiallyPaid(status: SupplierInvoiceStatus): boolean {
  return status === "VALIDATED";
}

export function canMarkSupplierInvoiceOverdue(status: SupplierInvoiceStatus): boolean {
  return status === "VALIDATED";
}

export function isSupplierInvoiceOverdue(
  dueDate: Date,
  amountDue: MoneyInput,
  now: Date = new Date(),
): boolean {
  if (!isPositive(amountDue)) return false;
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  return now > end;
}

export function recalculateSupplierInvoicePaymentStatus(input: {
  status: SupplierInvoiceStatus;
  paymentStatus: SupplierInvoicePaymentStatus;
  dueDate: Date;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  now?: Date;
}): SupplierInvoicePaymentStatus {
  if (input.status === "CANCELLED") return input.paymentStatus;
  if (isZero(input.amountDue)) return "PAID";
  if (isPositive(input.amountPaid) && isPositive(input.amountDue)) {
    if (isSupplierInvoiceOverdue(input.dueDate, input.amountDue, input.now)) return "OVERDUE";
    return "PARTIALLY_PAID";
  }
  if (isSupplierInvoiceOverdue(input.dueDate, input.amountDue, input.now)) return "OVERDUE";
  return "UNPAID";
}

export function getSupplierInvoiceRemainingAmount(invoice: {
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
}): number {
  return moneyToNumber(moneySub(invoice.totalIncludingTax, invoice.amountPaid));
}
