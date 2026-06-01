import type {
  SupplierInvoicePaymentStatus,
  SupplierInvoiceStatus,
} from "@prisma/client";
import { isSupplierInvoiceOverdue } from "@/lib/supplier-invoice-status";
import { isPositive, moneyAdd, moneyToNumber, type MoneyInput } from "@/lib/money";

export const SUPPLIER_INVOICE_ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "Facture créée",
  UPDATED: "Facture modifiée",
  VALIDATED: "Facture validée",
  CANCELLED: "Facture annulée",
  ARCHIVED: "Facture archivée",
  REACTIVATED: "Facture réactivée",
  ATTACHMENT_ADDED: "Pièce jointe ajoutée",
  MARKED_PAID_PLACEHOLDER: "Paiement enregistré",
  PARTIAL_PAYMENT_PLACEHOLDER: "Paiement partiel enregistré",
  MARKED_OVERDUE: "Marquée en retard",
  NOTE: "Note ajoutée",
};

export type SupplierInvoiceStats = {
  total: number;
  drafts: number;
  validated: number;
  toPay: number;
  overdue: number;
  totalDue: number;
  monthTotal: number;
  totalPaid: number;
  totalUnpaid: number;
  topSuppliers: { id: string; name: string; amount: number }[];
  byCategory: { name: string; amount: number }[];
};

export function computeSupplierInvoiceStats(
  invoices: {
    status: SupplierInvoiceStatus;
    paymentStatus: SupplierInvoicePaymentStatus;
    totalIncludingTax: MoneyInput;
    amountDue: MoneyInput;
    amountPaid: MoneyInput;
    dueDate: Date;
    isArchived: boolean;
    issueDate: Date;
    supplier: { id: string; name: string };
    expenseCategory: { name: string } | null;
  }[],
): SupplierInvoiceStats {
  const visible = invoices.filter((i) => !i.isArchived);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const toPay = visible.filter(
    (i) => i.status === "VALIDATED" && isPositive(i.amountDue) && i.paymentStatus !== "PAID",
  );
  const overdue = visible.filter(
    (i) =>
      i.status === "VALIDATED" &&
      (i.paymentStatus === "OVERDUE" || isSupplierInvoiceOverdue(i.dueDate, i.amountDue)),
  );

  const supplierMap = new Map<string, { name: string; amount: number }>();
  for (const inv of toPay) {
    const existing = supplierMap.get(inv.supplier.id) ?? { name: inv.supplier.name, amount: 0 };
    existing.amount = moneyToNumber(moneyAdd(existing.amount, inv.amountDue));
    supplierMap.set(inv.supplier.id, existing);
  }

  const categoryMap = new Map<string, number>();
  for (const inv of visible.filter((i) => i.status === "VALIDATED")) {
    const name = inv.expenseCategory?.name ?? "Sans catégorie";
    categoryMap.set(name, moneyToNumber(moneyAdd(categoryMap.get(name) ?? 0, inv.totalIncludingTax)));
  }

  return {
    total: visible.length,
    drafts: visible.filter((i) => i.status === "DRAFT").length,
    validated: visible.filter((i) => i.status === "VALIDATED").length,
    toPay: toPay.length,
    overdue: overdue.length,
    totalDue: moneyToNumber(toPay.reduce((s, i) => moneyAdd(s, i.amountDue), moneyAdd(0, 0))),
    monthTotal: moneyToNumber(
      visible
        .filter((i) => i.issueDate >= monthStart && i.status === "VALIDATED")
        .reduce((s, i) => moneyAdd(s, i.totalIncludingTax), moneyAdd(0, 0)),
    ),
    totalPaid: moneyToNumber(
      visible.reduce((s, i) => moneyAdd(s, i.amountPaid), moneyAdd(0, 0)),
    ),
    totalUnpaid: moneyToNumber(
      visible.reduce((s, i) => moneyAdd(s, i.amountDue), moneyAdd(0, 0)),
    ),
    topSuppliers: [...supplierMap.entries()]
      .map(([id, v]) => ({ id, name: v.name, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    byCategory: [...categoryMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
  };
}
