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
