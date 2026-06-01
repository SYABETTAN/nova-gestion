import type { Customer, CustomerStatus, CustomerType } from "@prisma/client";
import { moneyAdd, moneyToNumber, type MoneyInput } from "@/lib/money";

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Client actif",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  COMPANY: "Société",
  INDIVIDUAL: "Particulier",
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  PROSPECT: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-slate-100 text-slate-700",
  ARCHIVED: "bg-red-100 text-red-800",
};

export const CUSTOMER_ACTIVITY_LABELS: Record<string, string> = {
  NOTE: "Note",
  CALL: "Appel",
  EMAIL: "Email",
  MEETING: "Réunion",
  QUOTE_CREATED: "Devis créé",
  QUOTE_ACCEPTED: "Devis accepté",
  INVOICE_SENT: "Facture envoyée",
  PAYMENT_RECEIVED: "Paiement reçu",
  REMINDER_SENT: "Relance envoyée",
};

export function formatCustomerDisplayName(customer: Pick<Customer, "displayName" | "name" | "legalName">): string {
  return customer.displayName || customer.name || customer.legalName || "Client sans nom";
}

export function getCustomerStatusLabel(status: CustomerStatus): string {
  return CUSTOMER_STATUS_LABELS[status] ?? status;
}

export function getCustomerStatusColor(status: CustomerStatus): string {
  return CUSTOMER_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
}

export function getCustomerTypeLabel(type: CustomerType): string {
  return CUSTOMER_TYPE_LABELS[type] ?? type;
}

export type CustomerStats = {
  total: number;
  prospects: number;
  active: number;
  totalOutstanding: number;
};

export function computeCustomerStats(
  customers: { status: CustomerStatus; outstandingAmount: MoneyInput; isArchived: boolean }[],
): CustomerStats {
  const activeCustomers = customers.filter((c) => !c.isArchived);

  return {
    total: activeCustomers.length,
    prospects: activeCustomers.filter((c) => c.status === "PROSPECT").length,
    active: activeCustomers.filter((c) => c.status === "ACTIVE").length,
    totalOutstanding: moneyToNumber(
      activeCustomers.reduce((sum, c) => moneyAdd(sum, c.outstandingAmount), moneyAdd(0, 0)),
    ),
  };
}

export function formatCurrency(amount: MoneyInput, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(moneyToNumber(amount));
}

export function parseTagIds(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function getPrimaryCity(
  addresses: { city: string; isDefault: boolean; type: string }[],
): string | null {
  const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
  return defaultAddr?.city ?? null;
}
