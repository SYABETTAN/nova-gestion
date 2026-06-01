import { prisma } from "@/lib/prisma";
import type { DashboardData, DateRange } from "@/lib/dashboard-types";
import {
  computeOverdueBuckets,
  daysBetween,
  getTopByAmount,
  groupByMonth,
  groupByStatus,
  groupByStatusAmount,
  isInvoiceBillable,
  isInvoiceOverdue,
  safeDivide,
  sumBy,
} from "@/lib/dashboard-calculations";
import { buildDashboardAlerts, HIGH_OUTSTANDING_THRESHOLD } from "@/lib/dashboard-alerts";
import { isDateInRange } from "@/lib/dashboard-periods";
import { isPositive, money, moneyAdd, moneySub, moneyToNumber } from "@/lib/money";
import { roundMoney } from "@/lib/pricing";

const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  VIEWED: "Consulté",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
  CANCELLED: "Annulé",
  CONVERTED: "Converti",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Non payée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Virement",
  CARD: "Carte",
  CHECK: "Chèque",
  CASH: "Espèces",
  DIRECT_DEBIT: "Prélèvement",
  OTHER: "Autre",
};

const now = () => new Date();

export async function getDashboardData(
  organizationId: string,
  period: DateRange,
): Promise<DashboardData> {
  const today = now();

  const [
    customers,
    quotes,
    invoices,
    payments,
    reminders,
    suppliers,
    supplierInvoices,
    items,
    accountingEntries,
    auditLogs,
  ] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId, isArchived: false } }),
    prisma.quote.findMany({
      where: { organizationId, isArchived: false },
      include: { customer: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { organizationId, isArchived: false },
      include: {
        customer: { select: { id: true, name: true } },
        lines: { where: { lineType: { in: ["ITEM", "SERVICE"] } }, include: { item: true } },
      },
    }),
    prisma.payment.findMany({
      where: { organizationId, status: { not: "CANCELLED" } },
      include: { customer: { select: { name: true } } },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.reminder.findMany({
      where: { organizationId },
      include: { customer: { select: { name: true } } },
    }),
    prisma.supplier.findMany({ where: { organizationId, isArchived: false } }),
    prisma.supplierInvoice.findMany({
      where: { organizationId, isArchived: false, status: { not: "CANCELLED" } },
      include: {
        supplier: { select: { id: true, name: true } },
        expenseCategory: { select: { name: true } },
      },
    }),
    prisma.item.findMany({ where: { organizationId, isArchived: false, status: "ACTIVE" } }),
    prisma.accountingEntry.findMany({
      where: { organizationId, status: { not: "CANCELLED" } },
      include: { journal: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const periodQuotes = quotes.filter((q) => isDateInRange(q.createdAt, period.startDate, period.endDate));
  const periodInvoices = invoices.filter((i) =>
    isDateInRange(i.issueDate, period.startDate, period.endDate),
  );
  const billableInvoices = invoices.filter((i) => isInvoiceBillable(i.status));
  const periodPayments = payments.filter((p) =>
    isDateInRange(p.paymentDate, period.startDate, period.endDate),
  );
  const periodSupplierInvoices = supplierInvoices.filter((si) =>
    isDateInRange(si.issueDate, period.startDate, period.endDate),
  );
  const periodEntries = accountingEntries.filter((e) =>
    isDateInRange(e.entryDate, period.startDate, period.endDate),
  );

  const overdueInvoices = invoices.filter((i) =>
    isInvoiceOverdue(i.dueDate, i.amountDue, i.status, today),
  );

  const invoicedRevenue = sumBy(
    periodInvoices.filter((i) => isInvoiceBillable(i.status)),
    (i) => i.totalExcludingTax,
  );
  const cashCollected = sumBy(periodPayments, (p) => p.amount);
  const amountToCollect = sumBy(
    billableInvoices.filter((i) => isPositive(i.amountDue)),
    (i) => i.amountDue,
  );
  const supplierExpenses = sumBy(periodSupplierInvoices, (si) => si.totalExcludingTax);
  const simplifiedResult = roundMoney(moneySub(invoicedRevenue, supplierExpenses));

  const vatCollectedAgg = await prisma.accountingEntryLine.aggregate({
    where: {
      organizationId,
      credit: { gt: 0 },
      account: { accountNumber: "445710" },
      entry: { status: "VALIDATED", entryDate: { gte: period.startDate, lte: period.endDate } },
    },
    _sum: { credit: true },
  });
  const vatDeductibleAgg = await prisma.accountingEntryLine.aggregate({
    where: {
      organizationId,
      debit: { gt: 0 },
      account: { accountNumber: "445660" },
      entry: { status: "VALIDATED", entryDate: { gte: period.startDate, lte: period.endDate } },
    },
    _sum: { debit: true },
  });
  const vatCollected = roundMoney(
    money(vatCollectedAgg._sum.credit ?? sumBy(
      periodInvoices.filter((i) => isInvoiceBillable(i.status)),
      (i) => i.totalVatAmount,
    )),
  );
  const vatDeductible = roundMoney(
    money(vatDeductibleAgg._sum.debit ?? sumBy(periodSupplierInvoices, (si) => si.totalVatAmount)),
  );
  const netVat = roundMoney(moneySub(vatCollected, vatDeductible));

  const quotesSentOrDecided = periodQuotes.filter((q) =>
    ["SENT", "VIEWED", "ACCEPTED", "REFUSED", "CONVERTED"].includes(q.status),
  );
  const quotesAccepted = periodQuotes.filter((q) => ["ACCEPTED", "CONVERTED"].includes(q.status));

  const customerRevenueMap = new Map<string, { id: string; name: string; amount: number }>();
  for (const inv of billableInvoices) {
    if (!isDateInRange(inv.issueDate, period.startDate, period.endDate)) continue;
    const existing = customerRevenueMap.get(inv.customerId) ?? {
      id: inv.customer.id,
      name: inv.customer.name,
      amount: 0,
    };
    existing.amount = roundMoney(moneyAdd(existing.amount, inv.totalExcludingTax));
    customerRevenueMap.set(inv.customerId, existing);
  }

  const itemRevenueMap = new Map<string, { id: string; name: string; amount: number }>();
  for (const inv of billableInvoices) {
    for (const line of inv.lines) {
      const key = line.itemId ?? line.name;
      const existing = itemRevenueMap.get(key) ?? {
        id: line.itemId ?? key,
        name: line.item?.name ?? line.name,
        amount: 0,
      };
      existing.amount = roundMoney(moneyAdd(existing.amount, line.totalExcludingTax));
      itemRevenueMap.set(key, existing);
    }
  }
  if (itemRevenueMap.size === 0) {
    const quoteLines = await prisma.quoteLine.findMany({
      where: {
        organizationId,
        lineType: { in: ["ITEM", "SERVICE"] },
        quote: { createdAt: { gte: period.startDate, lte: period.endDate } },
      },
      include: { item: true },
    });
    for (const line of quoteLines) {
      const key = line.itemId ?? line.name;
      const existing = itemRevenueMap.get(key) ?? {
        id: line.itemId ?? key,
        name: line.item?.name ?? line.name,
        amount: 0,
      };
      existing.amount = roundMoney(moneyAdd(existing.amount, line.totalExcludingTax));
      itemRevenueMap.set(key, existing);
    }
  }

  const supplierMap = new Map<string, { id: string; name: string; amount: number }>();
  for (const si of periodSupplierInvoices) {
    const existing = supplierMap.get(si.supplierId) ?? {
      id: si.supplier.id,
      name: si.supplier.name,
      amount: 0,
    };
    existing.amount = roundMoney(moneyAdd(existing.amount, si.totalExcludingTax));
    supplierMap.set(si.supplierId, existing);
  }

  const categoryMap = new Map<string, number>();
  for (const si of periodSupplierInvoices) {
    const cat = si.expenseCategory?.name ?? "Sans catégorie";
    categoryMap.set(cat, roundMoney(moneyAdd(categoryMap.get(cat) ?? 0, si.totalExcludingTax)));
  }

  const overdueCustomerMap = new Map<string, { id: string; name: string; amount: number }>();
  for (const inv of overdueInvoices) {
    const existing = overdueCustomerMap.get(inv.customerId) ?? {
      id: inv.customer.id,
      name: inv.customer.name,
      amount: 0,
    };
    existing.amount = roundMoney(moneyAdd(existing.amount, inv.amountDue));
    overdueCustomerMap.set(inv.customerId, existing);
  }

  const journalMap = new Map<string, number>();
  for (const e of periodEntries) {
    journalMap.set(e.journal.code, (journalMap.get(e.journal.code) ?? 0) + 1);
  }

  const in7days = new Date(today);
  in7days.setDate(in7days.getDate() + 7);

  const alerts = buildDashboardAlerts({
    overdueInvoices: overdueInvoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      daysOverdue: daysBetween(i.dueDate, today),
      amountDue: moneyToNumber(i.amountDue),
    })),
    customersHighOutstanding: customers
      .filter((c) => isPositive(c.outstandingAmount) && moneyToNumber(c.outstandingAmount) >= HIGH_OUTSTANDING_THRESHOLD)
      .map((c) => ({ id: c.id, name: c.name, outstandingAmount: moneyToNumber(c.outstandingAmount) })),
    expiringQuotes: quotes.filter(
      (q) =>
        ["SENT", "VIEWED"].includes(q.status) &&
        q.validUntil >= today &&
        q.validUntil <= in7days,
    ).map((q) => ({ id: q.id, quoteNumber: q.quoteNumber, validUntil: q.validUntil })),
    dueSoonSupplierInvoices: supplierInvoices.filter(
      (si) => isPositive(si.amountDue) && si.dueDate >= today && si.dueDate <= in7days,
    ).map((si) => ({
      id: si.id,
      supplierInvoiceNumber: si.supplierInvoiceNumber,
      dueDate: si.dueDate,
      amountDue: moneyToNumber(si.amountDue),
    })),
    negativeMarginItems: items
      .filter((i) => moneyToNumber(i.marginAmount) < 0)
      .map((i) => ({ id: i.id, name: i.name, marginAmount: moneyToNumber(i.marginAmount) })),
    unbalancedEntries: accountingEntries
      .filter((e) => e.status === "DRAFT" && !e.isBalanced)
      .map((e) => ({ id: e.id, entryNumber: e.entryNumber })),
    netVat,
    disputedInvoices: invoices
      .filter((i) => i.isDisputed)
      .map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber })),
    unallocatedPayments: payments
      .filter((p) => isPositive(p.unallocatedAmount))
      .map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        unallocatedAmount: moneyToNumber(p.unallocatedAmount),
      })),
  });

  const recentActivity = auditLogs.slice(0, 15).map((log) => ({
    id: log.id,
    date: log.createdAt,
    type: log.action,
    title: log.entityLabel ?? log.action,
    description: log.entityType ?? undefined,
    userName: log.user?.name,
    href: entityHref(log.entityType, log.entityLabel),
  }));

  return {
    period,
    overview: {
      invoicedRevenue,
      cashCollected,
      amountToCollect,
      supplierExpenses,
      simplifiedResult,
      netVatIndicative: netVat,
    },
    commercial: {
      activeCustomers: customers.filter((c) => c.status === "ACTIVE").length,
      newCustomers: customers.filter((c) =>
        isDateInRange(c.createdAt, period.startDate, period.endDate),
      ).length,
      prospects: customers.filter((c) => c.status === "PROSPECT").length,
      quotesCount: periodQuotes.length,
      quotesTotal: sumBy(periodQuotes, (q) => q.totalIncludingTax),
      quotesAccepted: quotesAccepted.length,
      quoteAcceptanceRate: safeDivide(quotesAccepted.length, quotesSentOrDecided.length) * 100,
      averageQuoteValue: safeDivide(
        sumBy(periodQuotes, (q) => q.totalIncludingTax),
        periodQuotes.length,
      ),
      topCustomers: getTopByAmount([...customerRevenueMap.values()]),
      topItems: getTopByAmount([...itemRevenueMap.values()]),
      quotesByStatus: groupByStatus(periodQuotes, "status", QUOTE_STATUS_LABELS),
      quotesMonthly: groupByMonth(
        periodQuotes.map((q) => ({ date: q.createdAt, amount: q.totalIncludingTax })),
        period,
      ),
    },
    invoices: {
      revenueExcludingTax: invoicedRevenue,
      totalVat: sumBy(
        periodInvoices.filter((i) => isInvoiceBillable(i.status)),
        (i) => i.totalVatAmount,
      ),
      totalIncludingTax: sumBy(
        periodInvoices.filter((i) => isInvoiceBillable(i.status)),
        (i) => i.totalIncludingTax,
      ),
      invoiceCount: periodInvoices.length,
      draftCount: periodInvoices.filter((i) => i.status === "DRAFT").length,
      validatedCount: periodInvoices.filter((i) =>
        ["VALIDATED", "SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"].includes(i.status),
      ).length,
      paidCount: invoices.filter((i) => i.paymentStatus === "PAID" || i.status === "PAID").length,
      overdueCount: overdueInvoices.length,
      amountToCollect,
      averageInvoiceValue: safeDivide(
        sumBy(
          periodInvoices.filter((i) => isInvoiceBillable(i.status)),
          (i) => i.totalIncludingTax,
        ),
        periodInvoices.filter((i) => isInvoiceBillable(i.status)).length,
      ),
      revenueMonthly: groupByMonth(
        periodInvoices
          .filter((i) => isInvoiceBillable(i.status))
          .map((i) => ({ date: i.issueDate, amount: i.totalExcludingTax })),
        period,
      ),
      paymentStatusBreakdown: groupByStatusAmount(
        billableInvoices,
        "paymentStatus",
        "amountDue",
        PAYMENT_STATUS_LABELS,
      ),
    },
    payments: {
      collectedAmount: cashCollected,
      paymentCount: periodPayments.length,
      allocatedAmount: sumBy(payments, (p) => p.allocatedAmount),
      unallocatedAmount: sumBy(payments, (p) => p.unallocatedAmount),
      averagePayment: safeDivide(cashCollected, periodPayments.length),
      settledInvoices: invoices.filter(
        (i) =>
          (i.paymentStatus === "PAID" || i.status === "PAID") &&
          i.paidAt &&
          isDateInRange(i.paidAt, period.startDate, period.endDate),
      ).length,
      byMethod: groupByStatusAmount(periodPayments, "method", "amount", PAYMENT_METHOD_LABELS),
      cashInMonthly: groupByMonth(
        periodPayments.map((p) => ({ date: p.paymentDate, amount: p.amount })),
        period,
      ),
      recentPayments: payments.slice(0, 5).map((p) => ({
        id: p.id,
        number: p.paymentNumber,
        customerName: p.customer.name,
        amount: moneyToNumber(p.amount),
        date: p.paymentDate,
      })),
    },
    reminders: {
      invoicesToRemind: overdueInvoices.length,
      overdueAmount: sumBy(overdueInvoices, (i) => i.amountDue),
      averageOverdueDays:
        overdueInvoices.length > 0
          ? Math.round(
              sumBy(overdueInvoices, (i) => daysBetween(i.dueDate, today)) / overdueInvoices.length,
            )
          : 0,
      remindersSent: reminders.filter((r) => {
        const sentAt = r.sentAt ?? r.simulatedSentAt;
        return sentAt && isDateInRange(sentAt, period.startDate, period.endDate);
      }).length,
      disputedCount: invoices.filter((i) => i.isDisputed).length,
      pausedCount: invoices.filter((i) => i.isCollectionPaused).length,
      promisedCount: invoices.filter((i) => i.promisedPaymentDate).length,
      topOverdueCustomers: getTopByAmount([...overdueCustomerMap.values()]),
      overdueBuckets: computeOverdueBuckets(
        overdueInvoices.map((i) => ({
          daysOverdue: daysBetween(i.dueDate, today),
          amountDue: i.amountDue,
        })),
      ),
    },
    suppliers: {
      activeSuppliers: suppliers.filter((s) => s.status === "ACTIVE").length,
      preferredSuppliers: suppliers.filter((s) => s.isPreferred).length,
      highRiskSuppliers: suppliers.filter((s) => s.riskLevel === "HIGH").length,
      expensesAmount: supplierExpenses,
      amountToPay: sumBy(
        supplierInvoices.filter((si) => isPositive(si.amountDue)),
        (si) => si.amountDue,
      ),
      overdueSupplierInvoices: supplierInvoices.filter(
        (si) => isPositive(si.amountDue) && isInvoiceOverdue(si.dueDate, si.amountDue, "VALIDATED", today),
      ).length,
      expensesByCategory: [...categoryMap.entries()].map(([name, value]) => ({
        key: name,
        name,
        value,
      })),
      topSuppliers: getTopByAmount([...supplierMap.values()]),
      expensesMonthly: groupByMonth(
        periodSupplierInvoices.map((si) => ({
          date: si.issueDate,
          amount: si.totalExcludingTax,
        })),
        period,
      ),
    },
    accounting: {
      entryCount: periodEntries.length,
      draftCount: periodEntries.filter((e) => e.status === "DRAFT").length,
      validatedCount: periodEntries.filter((e) => e.status === "VALIDATED").length,
      unbalancedCount: accountingEntries.filter((e) => e.status === "DRAFT" && !e.isBalanced)
        .length,
      totalDebit: sumBy(periodEntries, (e) => e.totalDebit),
      totalCredit: sumBy(periodEntries, (e) => e.totalCredit),
      globalGap: Math.abs(
        sumBy(accountingEntries, (e) => e.totalDebit) - sumBy(accountingEntries, (e) => e.totalCredit),
      ),
      vatCollected,
      vatDeductible,
      netVat,
      byJournal: [...journalMap.entries()].map(([code, value]) => ({
        key: code,
        name: code,
        value,
      })),
    },
    alerts,
    recentActivity,
  };
}

function entityHref(entityType: string | null, entityLabel: string | null): string | undefined {
  if (!entityType || !entityLabel) return undefined;
  if (entityType === "Invoice" && entityLabel.includes("FAC")) return "/invoices";
  if (entityType === "Payment") return "/payments";
  if (entityType === "Quote") return "/quotes";
  if (entityType === "Customer") return "/customers";
  if (entityType === "SupplierInvoice") return "/supplier-invoices";
  if (entityType === "AccountingEntry") return "/accounting/entries";
  return undefined;
}

export function dashboardDataToKpiRows(data: DashboardData): {
  section: string;
  metricKey: string;
  metricLabel: string;
  value: number;
  currency: string;
}[] {
  const rows: { section: string; metricKey: string; metricLabel: string; value: number; currency: string }[] = [];
  const add = (section: string, key: string, label: string, value: number) =>
    rows.push({ section, metricKey: key, metricLabel: label, value, currency: "EUR" });

  add("Vue d'ensemble", "invoicedRevenue", "CA facturé", data.overview.invoicedRevenue);
  add("Vue d'ensemble", "cashCollected", "Encaissements", data.overview.cashCollected);
  add("Vue d'ensemble", "amountToCollect", "À encaisser", data.overview.amountToCollect);
  add("Vue d'ensemble", "supplierExpenses", "Dépenses fournisseurs", data.overview.supplierExpenses);
  add("Commercial", "activeCustomers", "Clients actifs", data.commercial.activeCustomers);
  add("Commercial", "quotesCount", "Devis créés", data.commercial.quotesCount);
  add("Facturation", "revenueExcludingTax", "CA HT", data.invoices.revenueExcludingTax);
  add("Facturation", "overdueCount", "Factures en retard", data.invoices.overdueCount);
  add("Paiements", "collectedAmount", "Montant encaissé", data.payments.collectedAmount);
  add("Relances", "overdueAmount", "Montant en retard", data.reminders.overdueAmount);
  add("Fournisseurs", "expensesAmount", "Dépenses", data.suppliers.expensesAmount);
  add("Comptabilité", "netVat", "TVA nette indicative", data.accounting.netVat);

  return rows;
}
