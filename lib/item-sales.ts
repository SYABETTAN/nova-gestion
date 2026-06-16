import type { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moneyAdd, moneySub, moneyToNumber, roundMoney } from "@/lib/money";

/** Factures comptabilisées dans les ventes (hors brouillons et annulations). */
export const SOLD_INVOICE_STATUSES: InvoiceStatus[] = [
  "VALIDATED",
  "SENT",
  "OVERDUE",
  "PARTIALLY_PAID",
  "PAID",
];

export type ItemSalesFilters = {
  from?: Date;
  to?: Date;
  itemId?: string;
  customerId?: string;
};

function invoiceDateFilter(filters: ItemSalesFilters): Prisma.InvoiceWhereInput {
  if (!filters.from && !filters.to) return {};
  return {
    issueDate: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  };
}

function soldLinesWhere(
  organizationId: string,
  filters: ItemSalesFilters,
): Prisma.InvoiceLineWhereInput {
  return {
    organizationId,
    lineType: { in: ["ITEM", "SERVICE", "FREE_TEXT"] },
    ...(filters.itemId ? { itemId: filters.itemId } : {}),
    invoice: {
      organizationId,
      isArchived: false,
      status: { in: SOLD_INVOICE_STATUSES },
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...invoiceDateFilter(filters),
    },
  };
}

export type ItemSoldStats = {
  quantitySold: number;
  revenueExcludingTax: number;
  revenueIncludingTax: number;
};

export async function getSoldStatsByItemIdsQuery(
  organizationId: string,
  itemIds: string[],
  filters: ItemSalesFilters = {},
): Promise<Map<string, ItemSoldStats>> {
  const result = new Map<string, ItemSoldStats>();
  if (itemIds.length === 0) return result;

  const rows = await prisma.invoiceLine.groupBy({
    by: ["itemId"],
    where: {
      ...soldLinesWhere(organizationId, filters),
      itemId: { in: itemIds },
    },
    _sum: {
      quantity: true,
      totalExcludingTax: true,
      totalIncludingTax: true,
    },
  });

  for (const row of rows) {
    if (!row.itemId) continue;
    result.set(row.itemId, {
      quantitySold: moneyToNumber(row._sum.quantity ?? 0),
      revenueExcludingTax: moneyToNumber(row._sum.totalExcludingTax ?? 0),
      revenueIncludingTax: moneyToNumber(row._sum.totalIncludingTax ?? 0),
    });
  }

  return result;
}

export type ItemStockSummary = {
  stockInitial: number;
  quantitySold: number;
  quantityRemaining: number | null;
  purchasePriceExcludingTax: number;
  salePriceExcludingTax: number;
  unitSymbol: string | null;
  isStockable: boolean;
};

export async function getItemStockSummariesQuery(
  organizationId: string,
  items: {
    id: string;
    isStockable: boolean;
    stockQuantity: Prisma.Decimal | number;
    purchasePriceExcludingTax: Prisma.Decimal | number;
    salePriceExcludingTax: Prisma.Decimal | number;
    unit?: { symbol: string } | null;
  }[],
): Promise<Map<string, ItemStockSummary>> {
  const ids = items.map((i) => i.id);
  const soldMap = await getSoldStatsByItemIdsQuery(organizationId, ids);
  const summaries = new Map<string, ItemStockSummary>();

  for (const item of items) {
    const sold = soldMap.get(item.id)?.quantitySold ?? 0;
    const stockInitial = moneyToNumber(item.stockQuantity);
    summaries.set(item.id, {
      stockInitial,
      quantitySold: sold,
      quantityRemaining: item.isStockable
        ? Math.max(0, moneyToNumber(roundMoney(moneySub(stockInitial, sold))))
        : null,
      purchasePriceExcludingTax: moneyToNumber(item.purchasePriceExcludingTax),
      salePriceExcludingTax: moneyToNumber(item.salePriceExcludingTax),
      unitSymbol: item.unit?.symbol ?? null,
      isStockable: item.isStockable,
    });
  }

  return summaries;
}

export type ItemSalesReportRow = {
  itemId: string;
  itemNumber: string;
  sku: string | null;
  name: string;
  quantitySold: number;
  revenueExcludingTax: number;
  revenueIncludingTax: number;
  marginAmount: number;
  purchasePriceExcludingTax: number;
  unitSymbol: string | null;
};

export type ItemSalesReport = {
  rows: ItemSalesReportRow[];
  totals: {
    quantitySold: number;
    revenueExcludingTax: number;
    revenueIncludingTax: number;
    marginAmount: number;
  };
};

export async function getItemSalesReportQuery(
  organizationId: string,
  filters: ItemSalesFilters,
): Promise<ItemSalesReport> {
  const grouped = await prisma.invoiceLine.groupBy({
    by: ["itemId"],
    where: {
      ...soldLinesWhere(organizationId, filters),
      itemId: { not: null },
    },
    _sum: {
      quantity: true,
      totalExcludingTax: true,
      totalIncludingTax: true,
    },
  });

  const itemIds = grouped.map((g) => g.itemId!).filter(Boolean);
  const items = itemIds.length
    ? await prisma.item.findMany({
        where: { organizationId, id: { in: itemIds } },
        select: {
          id: true,
          itemNumber: true,
          sku: true,
          name: true,
          purchasePriceExcludingTax: true,
          unit: { select: { symbol: true } },
        },
      })
    : [];
  const itemById = new Map(items.map((i) => [i.id, i]));

  const rows: ItemSalesReportRow[] = [];
  let totalQty = 0;
  let totalHt = 0;
  let totalTtc = 0;
  let totalMargin = 0;

  for (const group of grouped) {
    if (!group.itemId) continue;
    const item = itemById.get(group.itemId);
    if (!item) continue;

    const quantitySold = moneyToNumber(group._sum.quantity ?? 0);
    const revenueExcludingTax = moneyToNumber(group._sum.totalExcludingTax ?? 0);
    const revenueIncludingTax = moneyToNumber(group._sum.totalIncludingTax ?? 0);
    const purchaseUnit = moneyToNumber(item.purchasePriceExcludingTax);
    const marginAmount = moneyToNumber(
      roundMoney(moneySub(revenueExcludingTax, purchaseUnit * quantitySold)),
    );

    rows.push({
      itemId: item.id,
      itemNumber: item.itemNumber,
      sku: item.sku,
      name: item.name,
      quantitySold,
      revenueExcludingTax,
      revenueIncludingTax,
      marginAmount,
      purchasePriceExcludingTax: purchaseUnit,
      unitSymbol: item.unit?.symbol ?? null,
    });

    totalQty += quantitySold;
    totalHt += revenueExcludingTax;
    totalTtc += revenueIncludingTax;
    totalMargin += marginAmount;
  }

  rows.sort((a, b) => b.quantitySold - a.quantitySold);

  return {
    rows,
    totals: {
      quantitySold: totalQty,
      revenueExcludingTax: totalHt,
      revenueIncludingTax: totalTtc,
      marginAmount: totalMargin,
    },
  };
}
