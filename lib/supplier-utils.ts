import type { Supplier, SupplierRiskLevel, SupplierStatus, SupplierType } from "@prisma/client";
import { moneyAdd, moneyToNumber, type MoneyInput } from "@/lib/money";

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
};

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  COMPANY: "Société",
  INDIVIDUAL: "Particulier",
};

export const SUPPLIER_RISK_LABELS: Record<SupplierRiskLevel, string> = {
  LOW: "Risque faible",
  MEDIUM: "Risque moyen",
  HIGH: "Risque élevé",
};

export const SUPPLIER_STATUS_COLORS: Record<SupplierStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-slate-100 text-slate-700",
  ARCHIVED: "bg-red-100 text-red-800",
};

export const SUPPLIER_RISK_COLORS: Record<SupplierRiskLevel, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-800",
};

export const SUPPLIER_ACTIVITY_LABELS: Record<string, string> = {
  NOTE: "Note",
  CALL: "Appel",
  EMAIL: "Email",
  MEETING: "Réunion",
  SUPPLIER_CREATED: "Fournisseur créé",
  SUPPLIER_UPDATED: "Fournisseur modifié",
  PURCHASE_ORDER_PLACEHOLDER: "Bon de commande",
  SUPPLIER_INVOICE_PLACEHOLDER: "Facture fournisseur fictive",
  PAYMENT_PLACEHOLDER: "Paiement fournisseur",
  DOCUMENT_ADDED_PLACEHOLDER: "Document ajouté",
};

export function formatSupplierDisplayName(
  supplier: Pick<Supplier, "displayName" | "name" | "legalName">,
): string {
  return supplier.displayName || supplier.name || supplier.legalName || "Fournisseur sans nom";
}

export function getSupplierStatusLabel(status: SupplierStatus): string {
  return SUPPLIER_STATUS_LABELS[status] ?? status;
}

export function getSupplierTypeLabel(type: SupplierType): string {
  return SUPPLIER_TYPE_LABELS[type] ?? type;
}

export function getSupplierRiskLabel(risk: SupplierRiskLevel): string {
  return SUPPLIER_RISK_LABELS[risk] ?? risk;
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

export function maskIban(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
}

export type SupplierStats = {
  total: number;
  active: number;
  preferred: number;
  totalOutstanding: number;
  totalPurchases: number;
  highRisk: number;
  inactive: number;
  avgPaymentTerms: number;
  topCategories: { name: string; count: number }[];
};

export function computeSupplierStats(
  suppliers: {
    status: SupplierStatus;
    outstandingAmount: MoneyInput;
    totalPurchasesAmount: MoneyInput;
    isArchived: boolean;
    isPreferred: boolean;
    riskLevel: SupplierRiskLevel;
    defaultPaymentTermsDays: number;
  }[],
  categories: { id: string; name: string; count: number }[] = [],
): SupplierStats {
  const visible = suppliers.filter((s) => !s.isArchived);
  const active = visible.filter((s) => s.status === "ACTIVE");
  const totalPaymentTerms = visible.reduce((sum, s) => sum + s.defaultPaymentTermsDays, 0);

  return {
    total: visible.length,
    active: active.length,
    preferred: visible.filter((s) => s.isPreferred).length,
    totalOutstanding: moneyToNumber(
      visible.reduce((sum, s) => moneyAdd(sum, s.outstandingAmount), moneyAdd(0, 0)),
    ),
    totalPurchases: moneyToNumber(
      visible.reduce((sum, s) => moneyAdd(sum, s.totalPurchasesAmount), moneyAdd(0, 0)),
    ),
    highRisk: visible.filter((s) => s.riskLevel === "HIGH").length,
    inactive: visible.filter((s) => s.status === "INACTIVE").length,
    avgPaymentTerms: visible.length > 0 ? Math.round(totalPaymentTerms / visible.length) : 0,
    topCategories: categories.slice(0, 5),
  };
}

export function filterSuppliersByText<T extends {
  name: string;
  supplierNumber: string;
  email: string | null;
  status: string;
  type: string;
  riskLevel: string;
  isPreferred: boolean;
}>(
  suppliers: T[],
  filters: {
    q?: string;
    status?: string;
    type?: string;
    riskLevel?: string;
    preferred?: string;
  },
): T[] {
  return suppliers.filter((s) => {
    if (filters.status && s.status !== filters.status) return false;
    if (filters.type && s.type !== filters.type) return false;
    if (filters.riskLevel && s.riskLevel !== filters.riskLevel) return false;
    if (filters.preferred === "true" && !s.isPreferred) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const haystack = [s.name, s.supplierNumber, s.email ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
