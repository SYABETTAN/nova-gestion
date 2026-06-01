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
import { buildDashboardAlerts } from "@/lib/dashboard-alerts";
import { isPositive, money, moneyAdd, moneySub, moneyToNumber } from "@/lib/money";
import { roundMoney } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import {
  fetchDashboardEntities,
  filterBillablePeriodInvoices,
  mapHighOutstanding,
} from "@/lib/dashboard-fetch";

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

async function buildDashboardDataUncached(
  organizationId: string,
  period: DateRange,
  today: Date,
): Promise<DashboardData> {
  const fetched = await fetchDashboardEntities(organizationId, period, today);

  const {
    periodQuotes,
    periodInvoices,
    billableInvoices,
    overdueInvoices,
    periodPayments,
    periodSupplierInvoices,
    periodAccountingEntries,
    invoiceLinesForTopItems,
    quoteLinesFallback,
  } = fetched;

  const periodBillableInvoices = filterBillablePeriodInvoices(periodInvoices);

  const invoicedRevenue = sumBy(periodBillableInvoices, (i) => i.totalExcludingTax);
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
    money(vatCollectedAgg._sum.credit ?? sumBy(periodBillableInvoices, (i) => i.totalVatAmount)),
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
  for (const inv of periodBillableInvoices) {
    const existing = customerRevenueMap.get(inv.customerId) ?? {
      id: inv.customer.id,
      name: inv.customer.name,
      amount: 0,
    };
    existing.amount = roundMoney(moneyAdd(existing.amount, inv.totalExcludingTax));
    customerRevenueMap.set(inv.customerId, existing);
  }

  const itemRevenueMap = new Map<string, { id: string; name: string; amount: number }>();
  const lineSource =
    invoiceLinesForTopItems.length > 0 ? invoiceLinesForTopItems : quoteLinesFallback;
  for (const line of lineSource) {
    const key = line.itemId ?? line.name;
    const existing = itemRevenueMap.get(key) ?? {
      id: line.itemId ?? key,
      name: line.item?.name ?? line.name,
      amount: 0,
    };
    existing.amount = roundMoney(moneyAdd(existing.amount, line.totalExcludingTax));
    itemRevenueMap.set(key, existing);
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
  for (const e of periodAccountingEntries) {
    journalMap.set(e.journal.code, (journalMap.get(e.journal.code) ?? 0) + 1);
  }

  const alerts = buildDashboardAlerts({
    overdueInvoices: overdueInvoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      daysOverdue: daysBetween(i.dueDate, today),
      amountDue: moneyToNumber(i.amountDue),
    })),
    customersHighOutstanding: mapHighOutstanding(fetched.customersHighOutstanding),
    expiringQuotes: fetched.expiringQuotes,
    dueSoonSupplierInvoices: fetched.dueSoonSupplierInvoices.map((si) => ({
      id: si.id,
      supplierInvoiceNumber: si.supplierInvoiceNumber,
      dueDate: si.dueDate,
      amountDue: moneyToNumber(si.amountDue),
    })),
    negativeMarginItems: fetched.negativeMarginItems.map((i) => ({
      id: i.id,
      name: i.name,
      marginAmount: moneyToNumber(i.marginAmount),
    })),
    unbalancedEntries: fetched.unbalancedDraftEntries,
    netVat,
    disputedInvoices: fetched.disputedInvoices,
    unallocatedPayments: fetched.unallocatedPayments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      unallocatedAmount: moneyToNumber(p.unallocatedAmount),
    })),
  });

  const recentActivity = fetched.auditLogs.slice(0, 15).map((log) => ({
    id: log.id,
    date: log.createdAt,
    type: log.action,
    title: log.entityLabel ?? log.action,
    description: log.entityType ?? undefined,
    userName: log.user?.name,
    href: entityHref(log.entityType, log.entityLabel),
  }));

  const paidCount = billableInvoices.filter(
    (i) => i.paymentStatus === "PAID" || i.status === "PAID",
  ).length;

  const globalGap = Math.abs(
    moneyToNumber(fetched.accountingTotals._sum.totalDebit ?? 0) -
      moneyToNumber(fetched.accountingTotals._sum.totalCredit ?? 0),
  );

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
      activeCustomers: fetched.activeCustomersCount,
      newCustomers: fetched.newCustomersCount,
      prospects: fetched.prospectsCount,
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
      totalVat: sumBy(periodBillableInvoices, (i) => i.totalVatAmount),
      totalIncludingTax: sumBy(periodBillableInvoices, (i) => i.totalIncludingTax),
      invoiceCount: periodInvoices.length,
      draftCount: periodInvoices.filter((i) => i.status === "DRAFT").length,
      validatedCount: periodInvoices.filter((i) =>
        ["VALIDATED", "SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"].includes(i.status),
      ).length,
      paidCount,
      overdueCount: overdueInvoices.length,
      amountToCollect,
      averageInvoiceValue: safeDivide(
        sumBy(periodBillableInvoices, (i) => i.totalIncludingTax),
        periodBillableInvoices.length,
      ),
      revenueMonthly: groupByMonth(
        periodBillableInvoices.map((i) => ({ date: i.issueDate, amount: i.totalExcludingTax })),
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
      allocatedAmount: moneyToNumber(fetched.paymentSums._sum.allocatedAmount ?? 0),
      unallocatedAmount: moneyToNumber(fetched.paymentSums._sum.unallocatedAmount ?? 0),
      averagePayment: safeDivide(cashCollected, periodPayments.length),
      settledInvoices: billableInvoices.filter(
        (i) =>
          (i.paymentStatus === "PAID" || i.status === "PAID") &&
          i.paidAt &&
          i.paidAt >= period.startDate &&
          i.paidAt <= period.endDate,
      ).length,
      byMethod: groupByStatusAmount(periodPayments, "method", "amount", PAYMENT_METHOD_LABELS),
      cashInMonthly: groupByMonth(
        periodPayments.map((p) => ({ date: p.paymentDate, amount: p.amount })),
        period,
      ),
      recentPayments: fetched.recentPayments.map((p) => ({
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
      remindersSent: fetched.remindersSentCount,
      disputedCount: fetched.disputedCount,
      pausedCount: fetched.pausedCount,
      promisedCount: fetched.promisedCount,
      topOverdueCustomers: getTopByAmount([...overdueCustomerMap.values()]),
      overdueBuckets: computeOverdueBuckets(
        overdueInvoices.map((i) => ({
          daysOverdue: daysBetween(i.dueDate, today),
          amountDue: i.amountDue,
        })),
      ),
    },
    suppliers: {
      activeSuppliers: fetched.activeSuppliersCount,
      preferredSuppliers: fetched.preferredSuppliersCount,
      highRiskSuppliers: fetched.highRiskSuppliersCount,
      expensesAmount: supplierExpenses,
      amountToPay: sumBy(
        fetched.openSupplierInvoices.filter((si) => isPositive(si.amountDue)),
        (si) => si.amountDue,
      ),
      overdueSupplierInvoices: fetched.openSupplierInvoices.filter((si) =>
        isInvoiceOverdue(si.dueDate, si.amountDue, si.status, today),
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
      entryCount: periodAccountingEntries.length,
      draftCount: periodAccountingEntries.filter((e) => e.status === "DRAFT").length,
      validatedCount: periodAccountingEntries.filter((e) => e.status === "VALIDATED").length,
      unbalancedCount: fetched.unbalancedDraftEntries.length,
      totalDebit: sumBy(periodAccountingEntries, (e) => e.totalDebit),
      totalCredit: sumBy(periodAccountingEntries, (e) => e.totalCredit),
      globalGap,
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

export async function getDashboardData(
  organizationId: string,
  period: DateRange,
): Promise<DashboardData> {
  return buildDashboardDataUncached(organizationId, period, now());
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
