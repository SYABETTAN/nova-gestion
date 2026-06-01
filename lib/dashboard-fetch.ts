import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/dashboard-types";
import { HIGH_OUTSTANDING_THRESHOLD } from "@/lib/dashboard-alerts";
import { isInvoiceBillable } from "@/lib/dashboard-calculations";
import { moneyToNumber, type MoneyInput } from "@/lib/money";

const BILLABLE_INVOICE_STATUSES = [
  "VALIDATED",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
] as const;

const invoiceSelect = {
  id: true,
  customerId: true,
  invoiceNumber: true,
  status: true,
  paymentStatus: true,
  issueDate: true,
  dueDate: true,
  paidAt: true,
  totalExcludingTax: true,
  totalVatAmount: true,
  totalIncludingTax: true,
  amountDue: true,
  isDisputed: true,
  isCollectionPaused: true,
  promisedPaymentDate: true,
  customer: { select: { id: true, name: true } },
} as const;

export type DashboardFetchResult = Awaited<ReturnType<typeof fetchDashboardEntities>>;

/** Charge uniquement les entités nécessaires au dashboard (filtres SQL, pas de scan org complet). */
export async function fetchDashboardEntities(
  organizationId: string,
  period: DateRange,
  today: Date,
) {
  const periodStart = period.startDate;
  const periodEnd = period.endDate;
  const in7days = new Date(today);
  in7days.setDate(in7days.getDate() + 7);

  const orgNotArchived = { organizationId, isArchived: false };

  const [
    activeCustomersCount,
    prospectsCount,
    newCustomersCount,
    periodQuotes,
    periodInvoices,
    billableInvoices,
    overdueInvoices,
    periodPayments,
    paymentSums,
    recentPayments,
    unallocatedPayments,
    remindersSentCount,
    disputedCount,
    pausedCount,
    promisedCount,
    activeSuppliersCount,
    preferredSuppliersCount,
    highRiskSuppliersCount,
    periodSupplierInvoices,
    openSupplierInvoices,
    dueSoonSupplierInvoices,
    expiringQuotes,
    customersHighOutstanding,
    negativeMarginItems,
    periodAccountingEntries,
    unbalancedDraftEntries,
    accountingTotals,
    auditLogs,
    invoiceLinesForTopItems,
  ] = await Promise.all([
    prisma.customer.count({ where: { ...orgNotArchived, status: "ACTIVE" } }),
    prisma.customer.count({ where: { ...orgNotArchived, status: "PROSPECT" } }),
    prisma.customer.count({
      where: { ...orgNotArchived, createdAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.quote.findMany({
      where: { ...orgNotArchived, createdAt: { gte: periodStart, lte: periodEnd } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        totalIncludingTax: true,
        quoteNumber: true,
        validUntil: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { ...orgNotArchived, issueDate: { gte: periodStart, lte: periodEnd } },
      select: invoiceSelect,
    }),
    prisma.invoice.findMany({
      where: {
        ...orgNotArchived,
        status: { in: [...BILLABLE_INVOICE_STATUSES] },
      },
      select: invoiceSelect,
    }),
    prisma.invoice.findMany({
      where: {
        ...orgNotArchived,
        amountDue: { gt: 0 },
        dueDate: { lt: today },
        status: { in: ["VALIDATED", "SENT", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: invoiceSelect,
    }),
    prisma.payment.findMany({
      where: {
        organizationId,
        status: { not: "CANCELLED" },
        paymentDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        paymentNumber: true,
        paymentDate: true,
        amount: true,
        method: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.payment.aggregate({
      where: { organizationId, status: { not: "CANCELLED" } },
      _sum: { allocatedAmount: true, unallocatedAmount: true },
    }),
    prisma.payment.findMany({
      where: { organizationId, status: { not: "CANCELLED" } },
      select: {
        id: true,
        paymentNumber: true,
        paymentDate: true,
        amount: true,
        customer: { select: { name: true } },
      },
      orderBy: { paymentDate: "desc" },
      take: 5,
    }),
    prisma.payment.findMany({
      where: { organizationId, status: { not: "CANCELLED" }, unallocatedAmount: { gt: 0 } },
      select: { id: true, paymentNumber: true, unallocatedAmount: true },
    }),
    prisma.reminder.count({
      where: {
        organizationId,
        OR: [
          { sentAt: { gte: periodStart, lte: periodEnd } },
          { simulatedSentAt: { gte: periodStart, lte: periodEnd } },
        ],
      },
    }),
    prisma.invoice.count({ where: { ...orgNotArchived, isDisputed: true } }),
    prisma.invoice.count({ where: { ...orgNotArchived, isCollectionPaused: true } }),
    prisma.invoice.count({
      where: { ...orgNotArchived, promisedPaymentDate: { not: null } },
    }),
    prisma.supplier.count({ where: { ...orgNotArchived, status: "ACTIVE" } }),
    prisma.supplier.count({ where: { ...orgNotArchived, isPreferred: true } }),
    prisma.supplier.count({ where: { ...orgNotArchived, riskLevel: "HIGH" } }),
    prisma.supplierInvoice.findMany({
      where: {
        ...orgNotArchived,
        status: { not: "CANCELLED" },
        issueDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        supplierId: true,
        issueDate: true,
        totalExcludingTax: true,
        totalVatAmount: true,
        supplier: { select: { id: true, name: true } },
        expenseCategory: { select: { name: true } },
      },
    }),
    prisma.supplierInvoice.findMany({
      where: {
        ...orgNotArchived,
        status: { not: "CANCELLED" },
        amountDue: { gt: 0 },
      },
      select: {
        id: true,
        supplierInvoiceNumber: true,
        dueDate: true,
        amountDue: true,
        status: true,
      },
    }),
    prisma.supplierInvoice.findMany({
      where: {
        ...orgNotArchived,
        amountDue: { gt: 0 },
        dueDate: { gte: today, lte: in7days },
      },
      select: {
        id: true,
        supplierInvoiceNumber: true,
        dueDate: true,
        amountDue: true,
      },
    }),
    prisma.quote.findMany({
      where: {
        ...orgNotArchived,
        status: { in: ["SENT", "VIEWED"] },
        validUntil: { gte: today, lte: in7days },
      },
      select: { id: true, quoteNumber: true, validUntil: true },
    }),
    prisma.customer.findMany({
      where: {
        ...orgNotArchived,
        outstandingAmount: { gte: HIGH_OUTSTANDING_THRESHOLD },
      },
      select: { id: true, name: true, outstandingAmount: true },
    }),
    prisma.item.findMany({
      where: { ...orgNotArchived, status: "ACTIVE", marginAmount: { lt: 0 } },
      select: { id: true, name: true, marginAmount: true },
    }),
    prisma.accountingEntry.findMany({
      where: {
        organizationId,
        status: { not: "CANCELLED" },
        entryDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        status: true,
        entryDate: true,
        totalDebit: true,
        totalCredit: true,
        isBalanced: true,
        journal: { select: { code: true } },
      },
    }),
    prisma.accountingEntry.findMany({
      where: { organizationId, status: "DRAFT", isBalanced: false },
      select: { id: true, entryNumber: true },
    }),
    prisma.accountingEntry.aggregate({
      where: { organizationId, status: { not: "CANCELLED" } },
      _sum: { totalDebit: true, totalCredit: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
    prisma.invoiceLine.findMany({
      where: {
        organizationId,
        lineType: { in: ["ITEM", "SERVICE"] },
        invoice: {
          ...orgNotArchived,
          issueDate: { gte: periodStart, lte: periodEnd },
          status: { in: [...BILLABLE_INVOICE_STATUSES] },
        },
      },
      select: {
        itemId: true,
        name: true,
        totalExcludingTax: true,
        item: { select: { id: true, name: true } },
      },
    }),
  ]);

  const disputedInvoices = disputedCount > 0
    ? await prisma.invoice.findMany({
        where: { ...orgNotArchived, isDisputed: true },
        select: { id: true, invoiceNumber: true },
        take: 20,
      })
    : [];

  const quoteLinesFallback =
    invoiceLinesForTopItems.length === 0
      ? await prisma.quoteLine.findMany({
          where: {
            organizationId,
            lineType: { in: ["ITEM", "SERVICE"] },
            quote: { createdAt: { gte: periodStart, lte: periodEnd } },
          },
          select: {
            itemId: true,
            name: true,
            totalExcludingTax: true,
            item: { select: { id: true, name: true } },
          },
        })
      : [];

  return {
    activeCustomersCount,
    prospectsCount,
    newCustomersCount,
    periodQuotes,
    periodInvoices,
    billableInvoices,
    overdueInvoices,
    periodPayments,
    paymentSums,
    recentPayments,
    unallocatedPayments,
    remindersSentCount,
    disputedCount,
    pausedCount,
    promisedCount,
    activeSuppliersCount,
    preferredSuppliersCount,
    highRiskSuppliersCount,
    periodSupplierInvoices,
    openSupplierInvoices,
    dueSoonSupplierInvoices,
    expiringQuotes,
    customersHighOutstanding,
    negativeMarginItems,
    periodAccountingEntries,
    unbalancedDraftEntries,
    accountingTotals,
    auditLogs,
    invoiceLinesForTopItems,
    quoteLinesFallback,
    disputedInvoices,
  };
}

export function filterBillablePeriodInvoices<T extends { status: string }>(invoices: T[]): T[] {
  return invoices.filter((i) => isInvoiceBillable(i.status));
}

export function mapHighOutstanding(
  customers: { id: string; name: string; outstandingAmount: MoneyInput }[],
) {
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    outstandingAmount: moneyToNumber(c.outstandingAmount),
  }));
}
