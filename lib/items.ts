import type { Prisma } from "@prisma/client";
import { hasFilterValue } from "@/lib/filter-params";
import type { ItemFilterInput } from "@/lib/item-validators";
import { prisma } from "@/lib/prisma";
import { moneyToNumber } from "@/lib/money";

const defaultInclude = {
  category: true,
  supplier: { select: { id: true, name: true, supplierNumber: true } },
  unit: true,
  tagAssignments: { include: { tag: true } },
} satisfies Prisma.ItemInclude;

export function buildItemWhere(
  organizationId: string,
  filters: Partial<ItemFilterInput>,
): Prisma.ItemWhereInput {
  const archivedFilter = filters.archived ?? "false";

  return {
    organizationId,
    ...(archivedFilter === "false" && filters.status !== "ARCHIVED"
      ? { isArchived: false }
      : {}),
    ...(archivedFilter === "only" ? { isArchived: true } : {}),
    ...(hasFilterValue(filters.type)
      ? { type: filters.type as Prisma.EnumItemTypeFilter["equals"] }
      : {}),
    ...(hasFilterValue(filters.status) && filters.status !== "ARCHIVED"
      ? { status: filters.status as Prisma.EnumItemStatusFilter["equals"] }
      : {}),
    ...(filters.status === "ARCHIVED" ? { status: "ARCHIVED", isArchived: true } : {}),
    ...(hasFilterValue(filters.categoryId) ? { categoryId: filters.categoryId } : {}),
    ...(hasFilterValue(filters.familyId) ? { category: { parentId: filters.familyId } } : {}),
    ...(hasFilterValue(filters.supplierId) ? { supplierId: filters.supplierId } : {}),
    ...(filters.vatRate ? { defaultVatRate: Number(filters.vatRate) } : {}),
    ...(filters.isRecurring === "true" ? { isRecurring: true } : {}),
    ...(filters.isRecurring === "false" ? { isRecurring: false } : {}),
    ...(filters.isStockable === "true" ? { isStockable: true } : {}),
    ...(filters.isStockable === "false" ? { isStockable: false } : {}),
    ...(hasFilterValue(filters.tagId)
      ? { tagAssignments: { some: { tagId: filters.tagId } } }
      : {}),
    ...(hasFilterValue(filters.q)
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { itemNumber: { contains: filters.q, mode: "insensitive" } },
            { sku: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
            { barcode: { contains: filters.q, mode: "insensitive" } },
            { shortDescription: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export type ItemSelectOption = {
  id: string;
  itemNumber: string;
  name: string;
  type: string;
  salePriceExcludingTax: number;
  salePriceIncludingTax: number;
  defaultVatRate: number;
  shortDescription: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  unitSymbol: string | null;
  categoryName: string | null;
  isStockable: boolean;
  stockQuantity: number;
};

function mapItemSelectOption(item: {
  id: string;
  itemNumber: string;
  name: string;
  type: string;
  salePriceExcludingTax: import("@/lib/money").MoneyInput;
  salePriceIncludingTax: import("@/lib/money").MoneyInput;
  defaultVatRate: import("@/lib/money").MoneyInput;
  shortDescription: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  isStockable: boolean;
  stockQuantity: import("@/lib/money").MoneyInput;
  unit: { symbol: string } | null;
  category: { name: string } | null;
}): ItemSelectOption {
  return {
    id: item.id,
    itemNumber: item.itemNumber,
    name: item.name,
    type: item.type,
    salePriceExcludingTax: moneyToNumber(item.salePriceExcludingTax),
    salePriceIncludingTax: moneyToNumber(item.salePriceIncludingTax),
    defaultVatRate: moneyToNumber(item.defaultVatRate),
    shortDescription: item.shortDescription,
    description: item.description,
    sku: item.sku,
    barcode: item.barcode,
    unitSymbol: item.unit?.symbol ?? null,
    categoryName: item.category?.name ?? null,
    isStockable: item.isStockable,
    stockQuantity: moneyToNumber(item.stockQuantity),
  };
}

const ITEM_SELECT_FIELDS = {
  id: true,
  itemNumber: true,
  name: true,
  type: true,
  salePriceExcludingTax: true,
  salePriceIncludingTax: true,
  defaultVatRate: true,
  shortDescription: true,
  description: true,
  sku: true,
  barcode: true,
  isStockable: true,
  stockQuantity: true,
  unit: { select: { symbol: true } },
  category: { select: { name: true } },
} satisfies Prisma.ItemSelect;

export async function searchItemsForSelectQuery(
  organizationId: string,
  query: string,
  limit = 20,
): Promise<ItemSelectOption[]> {
  const q = query.trim();
  const where: Prisma.ItemWhereInput = {
    organizationId,
    isArchived: false,
    status: "ACTIVE",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { itemNumber: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { shortDescription: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const items = await prisma.item.findMany({
    where,
    select: ITEM_SELECT_FIELDS,
    orderBy: { name: "asc" },
    take: limit,
  });
  return items.map(mapItemSelectOption);
}

export async function getItemSelectOptionByIdQuery(
  organizationId: string,
  itemId: string,
): Promise<ItemSelectOption | null> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, organizationId },
    select: ITEM_SELECT_FIELDS,
  });
  return item ? mapItemSelectOption(item) : null;
}

export async function listItemsQuery(
  organizationId: string,
  filters: Partial<ItemFilterInput>,
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";

  const where = buildItemWhere(organizationId, filters);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: defaultInclude,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: pageSize,
    }),
    prisma.item.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export type ItemGridRow = {
  id: string;
  itemNumber: string;
  sku: string | null;
  name: string;
  description: string | null;
  type: string;
  status: string;
  categoryName: string | null;
  supplierName: string | null;
  purchasePriceExcludingTax: number;
  salePriceExcludingTax: number;
  defaultVatRate: number;
  isStockable: boolean;
  stockInitial: number;
  quantitySold: number;
  stockRemaining: number | null;
  revenueExcludingTax: number;
  lastSaleDate: string | null;
  currency: string;
  unitSymbol: string | null;
};

export async function listItemsForGridQuery(
  organizationId: string,
  filters: Partial<ItemFilterInput> & {
    stockState?: string; // positive | zero | negative
    saleFrom?: string;
    saleTo?: string;
  },
) {
  const { getSoldStatsByItemIdsQuery } = await import("@/lib/item-sales");
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));

  const where = buildItemWhere(organizationId, filters);
  if (filters.stockState === "positive") where.stockQuantity = { gt: 0 };
  else if (filters.stockState === "zero") where.stockQuantity = { equals: 0 };
  else if (filters.stockState === "negative") where.stockQuantity = { lt: 0 };

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      select: {
        id: true,
        itemNumber: true,
        sku: true,
        name: true,
        description: true,
        type: true,
        status: true,
        currency: true,
        defaultVatRate: true,
        salePriceExcludingTax: true,
        purchasePriceExcludingTax: true,
        isStockable: true,
        stockQuantity: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
        unit: { select: { symbol: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.item.count({ where }),
  ]);

  const ids = items.map((i) => i.id);
  const saleFilters = {
    from: filters.saleFrom ? new Date(filters.saleFrom) : undefined,
    to: filters.saleTo ? new Date(`${filters.saleTo}T23:59:59.999`) : undefined,
  };
  const [soldMap, lastSales] = await Promise.all([
    getSoldStatsByItemIdsQuery(organizationId, ids, saleFilters),
    ids.length
      ? prisma.invoiceLine.findMany({
          where: {
            organizationId,
            itemId: { in: ids },
            invoice: { organizationId, isArchived: false, status: { notIn: ["DRAFT", "CANCELLED"] } },
          },
          select: { itemId: true, invoice: { select: { issueDate: true } } },
          orderBy: { invoice: { issueDate: "desc" } },
          distinct: ["itemId"],
        })
      : Promise.resolve([] as Array<{ itemId: string | null; invoice: { issueDate: Date } }>),
  ]);
  const lastSaleByItem = new Map<string, Date>();
  for (const l of lastSales) {
    if (l.itemId && !lastSaleByItem.has(l.itemId)) lastSaleByItem.set(l.itemId, l.invoice.issueDate);
  }

  const rows: ItemGridRow[] = items.map((i) => {
    const sold = soldMap.get(i.id);
    const stockInitial = moneyToNumber(i.stockQuantity);
    const quantitySold = sold?.quantitySold ?? 0;
    return {
      id: i.id,
      itemNumber: i.itemNumber,
      sku: i.sku,
      name: i.name,
      description: i.description,
      type: i.type,
      status: i.status,
      categoryName: i.category?.name ?? null,
      supplierName: i.supplier?.name ?? null,
      purchasePriceExcludingTax: moneyToNumber(i.purchasePriceExcludingTax),
      salePriceExcludingTax: moneyToNumber(i.salePriceExcludingTax),
      defaultVatRate: moneyToNumber(i.defaultVatRate),
      isStockable: i.isStockable,
      stockInitial,
      quantitySold,
      stockRemaining: i.isStockable ? Math.max(0, stockInitial - quantitySold) : null,
      revenueExcludingTax: sold?.revenueExcludingTax ?? 0,
      lastSaleDate: lastSaleByItem.get(i.id)?.toISOString() ?? null,
      currency: i.currency,
      unitSymbol: i.unit?.symbol ?? null,
    };
  });

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function buildItemsGridCsv(rows: ItemGridRow[]): string {
  const header = [
    "Référence",
    "Désignation",
    "Catégorie",
    "Fournisseur",
    "Prix achat HT",
    "Prix vente HT",
    "TVA",
    "Stock initial",
    "Qté vendue",
    "Stock restant",
    "CA HT vendu",
    "Dernière vente",
    "Statut",
  ].join(";");
  const lines = rows.map((r) =>
    [
      r.itemNumber,
      r.name,
      r.categoryName ?? "",
      r.supplierName ?? "",
      r.purchasePriceExcludingTax.toFixed(2),
      r.salePriceExcludingTax.toFixed(2),
      `${r.defaultVatRate}%`,
      r.stockInitial,
      r.quantitySold,
      r.stockRemaining ?? "",
      r.revenueExcludingTax.toFixed(2),
      r.lastSaleDate ? new Date(r.lastSaleDate).toLocaleDateString("fr-FR") : "",
      r.status,
    ].join(";"),
  );
  return [header, ...lines].join("\n");
}

export async function getItemByIdQuery(organizationId: string, id: string) {
  return prisma.item.findFirst({
    where: { id, organizationId },
    include: {
      category: true,
      unit: true,
      tagAssignments: { include: { tag: true } },
      priceHistory: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { changedAt: "desc" },
      },
      activities: { orderBy: { activityDate: "desc" } },
    },
  });
}

export async function getItemStatsQuery(organizationId: string) {
  return prisma.item.findMany({
    where: { organizationId },
    select: {
      type: true,
      status: true,
      isArchived: true,
      salePriceExcludingTax: true,
      marginRate: true,
    },
  });
}

export async function getItemCategoriesQuery(organizationId: string) {
  return prisma.itemCategory.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getItemUnitsQuery(organizationId: string) {
  return prisma.itemUnit.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getItemTagsQuery(organizationId: string) {
  return prisma.itemTag.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
}

export function filterItemsByText<T extends {
  name: string;
  itemNumber: string;
  sku: string | null;
  type: string;
  status: string;
}>(items: T[], filters: { q?: string; type?: string; status?: string }): T[] {
  return items.filter((item) => {
    if (filters.type && item.type !== filters.type) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const haystack = [item.name, item.itemNumber, item.sku ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function filterItemsByTag<T extends { tagAssignments?: { tagId: string }[] }>(
  items: T[],
  tagId?: string,
): T[] {
  if (!tagId) return items;
  return items.filter((i) => i.tagAssignments?.some((a) => a.tagId === tagId));
}

export function filterItemsByCategory<T extends { categoryId: string | null }>(
  items: T[],
  categoryId?: string,
): T[] {
  if (!categoryId) return items;
  return items.filter((i) => i.categoryId === categoryId);
}
