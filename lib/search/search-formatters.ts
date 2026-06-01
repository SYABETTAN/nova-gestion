import { formatCurrency } from "@/lib/pricing";
import type { MoneyInput } from "@/lib/money";
import { INVOICE_STATUS_LABELS } from "@/lib/invoice-status";
import { QUOTE_STATUS_LABELS } from "@/lib/quote-status";
import { SUPPLIER_INVOICE_STATUS_LABELS } from "@/lib/supplier-invoice-status";

export function formatSearchAmount(amount: MoneyInput, currency = "EUR"): string {
  return formatCurrency(amount, currency);
}

export function formatSearchDate(date: Date): string {
  return new Date(date).toLocaleDateString("fr-FR");
}

export function invoiceStatusLabel(status: string, paymentStatus?: string): string {
  const base = INVOICE_STATUS_LABELS[status as keyof typeof INVOICE_STATUS_LABELS] ?? status;
  if (paymentStatus === "OVERDUE") return `${base} · En retard`;
  if (paymentStatus === "PARTIALLY_PAID") return `${base} · Partiel`;
  if (paymentStatus === "PAID") return `${base} · Payée`;
  return base;
}

export function quoteStatusLabel(status: string): string {
  return QUOTE_STATUS_LABELS[status as keyof typeof QUOTE_STATUS_LABELS] ?? status;
}

export function supplierInvoiceStatusLabel(status: string): string {
  return SUPPLIER_INVOICE_STATUS_LABELS[status as keyof typeof SUPPLIER_INVOICE_STATUS_LABELS] ?? status;
}
