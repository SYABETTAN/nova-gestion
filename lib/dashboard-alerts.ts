import type { DashboardAlert } from "@/lib/dashboard-types";
import { isInvoiceOverdue } from "@/lib/dashboard-calculations";

const HIGH_OUTSTANDING_THRESHOLD = 5000;
const HIGH_VAT_NET_THRESHOLD = 2000;

export function buildDashboardAlerts(input: {
  overdueInvoices: {
    id: string;
    invoiceNumber: string;
    daysOverdue: number;
    amountDue: number;
  }[];
  customersHighOutstanding: { id: string; name: string; outstandingAmount: number }[];
  expiringQuotes: { id: string; quoteNumber: string; validUntil: Date }[];
  dueSoonSupplierInvoices: {
    id: string;
    supplierInvoiceNumber: string;
    dueDate: Date;
    amountDue: number;
  }[];
  negativeMarginItems: { id: string; name: string; marginAmount: number }[];
  unbalancedEntries: { id: string; entryNumber: string }[];
  netVat: number;
  disputedInvoices: { id: string; invoiceNumber: string }[];
  unallocatedPayments: { id: string; paymentNumber: string; unallocatedAmount: number }[];
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  for (const inv of input.overdueInvoices.slice(0, 5)) {
    alerts.push({
      id: `overdue-${inv.id}`,
      type: "OVERDUE_INVOICE",
      severity: inv.daysOverdue > 30 ? "CRITICAL" : "WARNING",
      title: `Facture ${inv.invoiceNumber} en retard`,
      description: `${inv.daysOverdue} jours de retard — ${inv.amountDue.toLocaleString("fr-FR")} € dus`,
      entityType: "Invoice",
      entityId: inv.id,
      href: `/invoices/${inv.id}`,
    });
  }

  for (const c of input.customersHighOutstanding) {
    alerts.push({
      id: `outstanding-${c.id}`,
      type: "HIGH_OUTSTANDING_CUSTOMER",
      severity: c.outstandingAmount > 10000 ? "CRITICAL" : "WARNING",
      title: `Encours élevé — ${c.name}`,
      description: `Encours client : ${c.outstandingAmount.toLocaleString("fr-FR")} €`,
      entityType: "Customer",
      entityId: c.id,
      href: `/customers/${c.id}`,
    });
  }

  for (const q of input.expiringQuotes.slice(0, 3)) {
    alerts.push({
      id: `quote-exp-${q.id}`,
      type: "QUOTE_EXPIRING_SOON",
      severity: "INFO",
      title: `Devis ${q.quoteNumber} expire bientôt`,
      description: `Validité jusqu'au ${q.validUntil.toLocaleDateString("fr-FR")}`,
      entityType: "Quote",
      entityId: q.id,
      href: `/quotes/${q.id}`,
    });
  }

  for (const si of input.dueSoonSupplierInvoices.slice(0, 3)) {
    alerts.push({
      id: `si-due-${si.id}`,
      type: "SUPPLIER_INVOICE_DUE_SOON",
      severity: "INFO",
      title: `Facture fournisseur ${si.supplierInvoiceNumber} à payer`,
      description: `Échéance le ${si.dueDate.toLocaleDateString("fr-FR")} — ${si.amountDue.toLocaleString("fr-FR")} €`,
      entityType: "SupplierInvoice",
      entityId: si.id,
      href: `/supplier-invoices/${si.id}`,
    });
  }

  for (const item of input.negativeMarginItems.slice(0, 3)) {
    alerts.push({
      id: `margin-${item.id}`,
      type: "NEGATIVE_MARGIN_ITEM",
      severity: "WARNING",
      title: `Marge négative — ${item.name}`,
      description: `Marge : ${item.marginAmount.toLocaleString("fr-FR")} €`,
      entityType: "Item",
      entityId: item.id,
      href: `/items/${item.id}`,
    });
  }

  for (const e of input.unbalancedEntries.slice(0, 3)) {
    alerts.push({
      id: `unbalanced-${e.id}`,
      type: "ACCOUNTING_UNBALANCED_ENTRY",
      severity: "WARNING",
      title: `Écriture non équilibrée ${e.entryNumber}`,
      description: "Brouillon comptable à corriger avant validation",
      entityType: "AccountingEntry",
      entityId: e.id,
      href: `/accounting/entries/${e.id}`,
    });
  }

  if (input.netVat > HIGH_VAT_NET_THRESHOLD) {
    alerts.push({
      id: "vat-net",
      type: "VAT_NET_PAYABLE",
      severity: "INFO",
      title: "TVA nette indicative élevée",
      description: `${input.netVat.toLocaleString("fr-FR")} € à décaisser (indicatif)`,
      href: "/accounting/vat-summary",
    });
  }

  for (const inv of input.disputedInvoices.slice(0, 3)) {
    alerts.push({
      id: `dispute-${inv.id}`,
      type: "COLLECTION_DISPUTE",
      severity: "CRITICAL",
      title: `Litige — facture ${inv.invoiceNumber}`,
      description: "Facture en litige, recouvrement à traiter",
      entityType: "Invoice",
      entityId: inv.id,
      href: `/invoices/${inv.id}`,
    });
  }

  for (const p of input.unallocatedPayments.slice(0, 3)) {
    alerts.push({
      id: `unalloc-${p.id}`,
      type: "PAYMENT_UNALLOCATED",
      severity: "WARNING",
      title: `Paiement ${p.paymentNumber} non alloué`,
      description: `${p.unallocatedAmount.toLocaleString("fr-FR")} € à affecter`,
      entityType: "Payment",
      entityId: p.id,
      href: `/payments/${p.id}`,
    });
  }

  const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export { isInvoiceOverdue, HIGH_OUTSTANDING_THRESHOLD };
