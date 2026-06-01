import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/pricing";
import { moneyToNumber } from "@/lib/money";
import type { VatSummaryFilterInput } from "@/lib/accounting-validators";
import { buildDateRangeFilter } from "@/lib/accounting-utils";

export type VatSummaryRow = {
  date: Date;
  sourceType: string;
  documentNumber: string;
  partyName: string;
  baseExcludingTax: number;
  vatAmount: number;
  totalIncludingTax: number;
};

function buildPeriodFilter(filters: VatSummaryFilterInput) {
  if (filters.dateFrom || filters.dateTo) {
    return buildDateRangeFilter(filters.dateFrom, filters.dateTo);
  }
  if (filters.year && filters.month) {
    const start = new Date(filters.year, filters.month - 1, 1);
    const end = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  if (filters.year) {
    return {
      gte: new Date(filters.year, 0, 1),
      lte: new Date(filters.year, 11, 31, 23, 59, 59, 999),
    };
  }
  return undefined;
}

export async function getVatSummaryQuery(organizationId: string, filters: VatSummaryFilterInput) {
  const dateRange = buildPeriodFilter(filters);
  const invoiceStatuses = ["VALIDATED", "SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"] as const;

  const [customerInvoices, supplierInvoices, vatCollectedAgg, vatDeductibleAgg] =
    await Promise.all([
      prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: [...invoiceStatuses] },
          ...(dateRange ? { issueDate: dateRange } : {}),
        },
        include: { customer: { select: { name: true } } },
        orderBy: { issueDate: "desc" },
      }),
      prisma.supplierInvoice.findMany({
        where: {
          organizationId,
          status: "VALIDATED",
          ...(dateRange ? { issueDate: dateRange } : {}),
        },
        include: { supplier: { select: { name: true } } },
        orderBy: { issueDate: "desc" },
      }),
      prisma.accountingEntryLine.aggregate({
        where: {
          organizationId,
          credit: { gt: 0 },
          account: { accountNumber: "445710" },
          entry: {
            status: filters.includeDrafts === "true" ? undefined : "VALIDATED",
            ...(dateRange ? { entryDate: dateRange } : {}),
          },
        },
        _sum: { credit: true },
      }),
      prisma.accountingEntryLine.aggregate({
        where: {
          organizationId,
          debit: { gt: 0 },
          account: { accountNumber: "445660" },
          entry: {
            status: filters.includeDrafts === "true" ? undefined : "VALIDATED",
            ...(dateRange ? { entryDate: dateRange } : {}),
          },
        },
        _sum: { debit: true },
      }),
    ]);

  const vatCollected = roundMoney(vatCollectedAgg._sum.credit ?? 0);
  const vatDeductible = roundMoney(vatDeductibleAgg._sum.debit ?? 0);

  const rows: VatSummaryRow[] = [
    ...customerInvoices.map((inv) => ({
      date: inv.issueDate,
      sourceType: "CUSTOMER_INVOICE",
      documentNumber: inv.invoiceNumber,
      partyName: inv.customer.name,
      baseExcludingTax: moneyToNumber(inv.totalExcludingTax),
      vatAmount: moneyToNumber(inv.totalVatAmount),
      totalIncludingTax: moneyToNumber(inv.totalIncludingTax),
    })),
    ...supplierInvoices.map((inv) => ({
      date: inv.issueDate,
      sourceType: "SUPPLIER_INVOICE",
      documentNumber: inv.supplierInvoiceNumber,
      partyName: inv.supplier.name,
      baseExcludingTax: moneyToNumber(inv.totalExcludingTax),
      vatAmount: moneyToNumber(inv.totalVatAmount),
      totalIncludingTax: moneyToNumber(inv.totalIncludingTax),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    vatCollected,
    vatDeductible,
    vatNet: roundMoney(vatCollected - vatDeductible),
    customerInvoiceCount: customerInvoices.length,
    supplierInvoiceCount: supplierInvoices.length,
    rows,
  };
}
