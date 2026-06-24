"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import { generateItemsCsv } from "@/lib/csv";
import { createItemSchema, itemFilterSchema, updateItemSchema } from "@/lib/item-validators";
import { parseTagIds } from "@/lib/item-utils";
import { computeItemPricing } from "@/lib/pricing";
import { mapMoneyFieldsToDb, ITEM_MONEY_FIELDS } from "@/lib/money-db";
import { moneyEq, toDbDecimal } from "@/lib/money";
import {
  buildItemsGridCsv,
  buildItemWhere,
  getItemByIdQuery,
  getItemCategoriesQuery,
  getItemSelectOptionByIdQuery,
  getItemStatsQuery,
  getItemTagsQuery,
  getItemUnitsQuery,
  listItemsForGridQuery,
  listItemsQuery,
  searchItemsForSelectQuery,
} from "@/lib/items";
import {
  getItemSalesReportQuery,
  getItemStockSummariesQuery,
  type ItemSalesFilters,
} from "@/lib/item-sales";

function emptyToNull(value?: string | null): string | null {
  if (!value || value === "none") return null;
  return value;
}

function buildItemData(data: ReturnType<typeof createItemSchema.parse>) {
  const pricing = computeItemPricing({
    salePriceExcludingTax: data.salePriceExcludingTax,
    purchasePriceExcludingTax: data.purchasePriceExcludingTax,
    defaultVatRate: data.defaultVatRate,
  });

  return mapMoneyFieldsToDb(
    {
      type: data.type,
      status: data.status,
      name: data.name,
      sku: emptyToNull(data.sku),
      description: emptyToNull(data.description),
      shortDescription: emptyToNull(data.shortDescription),
      categoryId: emptyToNull(data.categoryId),
      supplierId: emptyToNull(data.supplierId),
      unitId: emptyToNull(data.unitId),
      imageUrl: emptyToNull(data.imageUrl),
      barcode: emptyToNull(data.barcode),
      defaultVatRate: data.defaultVatRate,
      salePriceExcludingTax: data.salePriceExcludingTax,
      salePriceIncludingTax: pricing.salePriceIncludingTax,
      purchasePriceExcludingTax: data.purchasePriceExcludingTax,
      marginAmount: pricing.marginAmount,
      marginRate: pricing.marginRate,
      currency: data.currency,
      isRecurring: data.isRecurring,
      recurringInterval: data.isRecurring
        ? ((data.recurringInterval as "MONTHLY" | "QUARTERLY" | "YEARLY" | undefined) ?? null)
        : null,
      isStockable: data.type === "SERVICE" ? false : data.isStockable,
      stockQuantity: data.isStockable ? data.stockQuantity : 0,
      stockAlertThreshold: data.isStockable ? data.stockAlertThreshold : 0,
      notes: emptyToNull(data.notes),
    },
    [...ITEM_MONEY_FIELDS],
  );
}

export async function listItemsAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");

  const { normalizeFilterSearchParams } = await import("@/lib/filter-params");
  const parsed = itemFilterSchema.safeParse(normalizeFilterSearchParams(searchParams));
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  return listItemsQuery(user.organizationId, filters);
}

function parseItemGridFilters(searchParams: Record<string, string | undefined>) {
  return {
    q: searchParams.q || undefined,
    type: searchParams.type || undefined,
    status: searchParams.status || undefined,
    categoryId: searchParams.categoryId || undefined,
    supplierId: searchParams.supplierId || undefined,
    stockState: searchParams.stockState || undefined,
    saleFrom: searchParams.saleFrom || undefined,
    saleTo: searchParams.saleTo || undefined,
    archived: (searchParams.archived as "true" | "false" | "only" | undefined) || undefined,
    page: searchParams.page ? Number(searchParams.page) : undefined,
    pageSize: searchParams.pageSize ? Number(searchParams.pageSize) : undefined,
  };
}

export async function listItemsForSageGridAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return listItemsForGridQuery(user.organizationId, parseItemGridFilters(searchParams));
}

export async function exportItemsGridCsvAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  const result = await listItemsForGridQuery(user.organizationId, {
    ...parseItemGridFilters(searchParams),
    page: 1,
    pageSize: 5000,
  });
  const csv = buildItemsGridCsv(result.rows);
  const date = new Date().toISOString().slice(0, 10);
  return { success: true as const, csv, filename: `articles-${date}.csv` };
}

export async function getItemStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");

  const items = await getItemStatsQuery(user.organizationId);
  const { computeItemStats } = await import("@/lib/item-utils");
  return computeItemStats(items);
}

export async function getItemByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return getItemByIdQuery(user.organizationId, id);
}

export async function searchItemsForSelectAction(query = "") {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return searchItemsForSelectQuery(user.organizationId, query, 20);
}

export async function getItemForInvoiceFormAction(itemId: string) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return getItemSelectOptionByIdQuery(user.organizationId, itemId);
}

/**
 * Création rapide d'un article depuis l'écran facture.
 * Renvoie l'option prête à insérer dans une ligne (multi-tenant).
 */
export async function quickCreateItemAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_CREATE");

  const result = await createItemAction(formData);
  if (!result.success || !result.itemId) {
    return { success: false as const, error: result.error ?? "Création impossible" };
  }
  const item = await getItemSelectOptionByIdQuery(user.organizationId, result.itemId);
  if (!item) return { success: false as const, error: "Article introuvable après création" };
  return { success: true as const, item };
}

export async function getItemCategoriesAction() {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return getItemCategoriesQuery(user.organizationId);
}

export async function getItemUnitsAction() {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return getItemUnitsQuery(user.organizationId);
}

export async function getItemTagsAction() {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return getItemTagsQuery(user.organizationId);
}

export async function getItemSuppliersAction() {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return prisma.supplier.findMany({
    where: { organizationId: user.organizationId, isArchived: false, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, supplierNumber: true },
    orderBy: { name: "asc" },
  });
}

export async function createItemAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_CREATE");

  const raw = Object.fromEntries(formData.entries());
  raw.isRecurring = raw.isRecurring === "on" || raw.isRecurring === "true" ? "true" : "false";
  raw.isStockable = raw.isStockable === "on" || raw.isStockable === "true" ? "true" : "false";

  const parsed = createItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const tagIds = parseTagIds(data.tagIds);

  if (data.sku) {
    const existing = await prisma.item.findFirst({
      where: { organizationId: user.organizationId, sku: data.sku },
    });
    if (existing) return { success: false, error: "Cette référence SKU existe déjà" };
  }

  const customItemNumber = data.itemNumber?.trim() || null;
  if (customItemNumber) {
    const existingNumber = await prisma.item.findFirst({
      where: { organizationId: user.organizationId, itemNumber: customItemNumber },
      select: { id: true },
    });
    if (existingNumber) return { success: false, error: "Ce code article existe déjà" };
  }

  const itemNumber = customItemNumber ?? (await generateNextNumber(user.organizationId, "ITEM", user.id));
  const itemData = buildItemData(data);

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        organizationId: user.organizationId,
        itemNumber,
        ...itemData,
      },
    });

    for (const tagId of tagIds) {
      await tx.itemTagAssignment.create({
        data: { organizationId: user.organizationId, itemId: created.id, tagId },
      });
    }

    await tx.itemActivity.create({
      data: {
        organizationId: user.organizationId,
        itemId: created.id,
        type: "CREATED",
        title: "Article créé",
        description: `${created.name} ajouté au catalogue.`,
        activityDate: new Date(),
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ITEM_CREATED",
    entityType: "Item",
    entityId: item.id,
    entityLabel: `${item.itemNumber} — ${item.name}`,
    newValues: { itemNumber, name: item.name, type: item.type },
  });

  revalidatePath("/items");
  return { success: true, itemId: item.id };
}

export async function updateItemAction(itemId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_UPDATE");

  const existing = await prisma.item.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Article introuvable" };
  if (existing.isArchived) return { success: false, error: "Réactivez l'article avant modification" };

  const raw = Object.fromEntries(formData.entries());
  raw.isRecurring = raw.isRecurring === "on" || raw.isRecurring === "true" ? "true" : "false";
  raw.isStockable = raw.isStockable === "on" || raw.isStockable === "true" ? "true" : "false";

  const parsed = updateItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const tagIds = parseTagIds(data.tagIds);

  if (data.sku && data.sku !== existing.sku) {
    const dup = await prisma.item.findFirst({
      where: { organizationId: user.organizationId, sku: data.sku, NOT: { id: itemId } },
    });
    if (dup) return { success: false, error: "Cette référence SKU existe déjà" };
  }

  const customItemNumber = data.itemNumber?.trim() || null;
  if (customItemNumber && customItemNumber !== existing.itemNumber) {
    const dupNumber = await prisma.item.findFirst({
      where: {
        organizationId: user.organizationId,
        itemNumber: customItemNumber,
        NOT: { id: itemId },
      },
      select: { id: true },
    });
    if (dupNumber) return { success: false, error: "Ce code article existe déjà" };
  }

  const itemData = buildItemData(data);
  const priceChanged =
    !moneyEq(existing.salePriceExcludingTax, itemData.salePriceExcludingTax) ||
    !moneyEq(existing.purchasePriceExcludingTax, itemData.purchasePriceExcludingTax) ||
    !moneyEq(existing.defaultVatRate, itemData.defaultVatRate);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.item.update({
      where: { id: itemId },
      data: {
        ...itemData,
        ...(customItemNumber ? { itemNumber: customItemNumber } : {}),
      },
    });

    await tx.itemTagAssignment.deleteMany({ where: { itemId } });
    for (const tagId of tagIds) {
      await tx.itemTagAssignment.create({
        data: { organizationId: user.organizationId, itemId, tagId },
      });
    }

    if (priceChanged) {
      await tx.itemPriceHistory.create({
        data: {
          organizationId: user.organizationId,
          itemId,
          oldSalePriceExcludingTax: existing.salePriceExcludingTax,
          newSalePriceExcludingTax: itemData.salePriceExcludingTax,
          oldPurchasePriceExcludingTax: existing.purchasePriceExcludingTax,
          newPurchasePriceExcludingTax: itemData.purchasePriceExcludingTax,
          oldVatRate: existing.defaultVatRate,
          newVatRate: itemData.defaultVatRate,
          changedById: user.id,
        },
      });

      await tx.itemActivity.create({
        data: {
          organizationId: user.organizationId,
          itemId,
          type: "PRICE_UPDATED",
          title: "Prix modifié",
          description: `HT : ${existing.salePriceExcludingTax} € → ${itemData.salePriceExcludingTax} €`,
          amount: itemData.salePriceExcludingTax,
          activityDate: new Date(),
        },
      });
    }

    await tx.itemActivity.create({
      data: {
        organizationId: user.organizationId,
        itemId,
        type: "UPDATED",
        title: "Article modifié",
        activityDate: new Date(),
      },
    });

    return result;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: priceChanged ? "ITEM_PRICE_UPDATED" : "ITEM_UPDATED",
    entityType: "Item",
    entityId: updated.id,
    entityLabel: `${updated.itemNumber} — ${updated.name}`,
    oldValues: { name: existing.name, salePriceExcludingTax: existing.salePriceExcludingTax },
    newValues: { name: updated.name, salePriceExcludingTax: updated.salePriceExcludingTax },
  });

  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  revalidatePath(`/items/${itemId}/edit`);
  return { success: true };
}

export async function archiveItemAction(itemId: string) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_DELETE");

  const existing = await prisma.item.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Article introuvable" };
  if (existing.isArchived) return { success: false, error: "Déjà archivé" };

  await prisma.$transaction([
    prisma.item.update({
      where: { id: itemId },
      data: { status: "ARCHIVED", isArchived: true, archivedAt: new Date() },
    }),
    prisma.itemActivity.create({
      data: {
        organizationId: user.organizationId,
        itemId,
        type: "ARCHIVED",
        title: "Article archivé",
        activityDate: new Date(),
      },
    }),
  ]);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ITEM_ARCHIVED",
    entityType: "Item",
    entityId: itemId,
    entityLabel: `${existing.itemNumber} — ${existing.name}`,
  });

  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  return { success: true };
}

export async function reactivateItemAction(itemId: string) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_DELETE");

  const existing = await prisma.item.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Article introuvable" };
  if (!existing.isArchived) return { success: false, error: "Non archivé" };

  await prisma.$transaction([
    prisma.item.update({
      where: { id: itemId },
      data: { status: "ACTIVE", isArchived: false, archivedAt: null },
    }),
    prisma.itemActivity.create({
      data: {
        organizationId: user.organizationId,
        itemId,
        type: "REACTIVATED",
        title: "Article réactivé",
        activityDate: new Date(),
      },
    }),
  ]);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ITEM_REACTIVATED",
    entityType: "Item",
    entityId: itemId,
    entityLabel: `${existing.itemNumber} — ${existing.name}`,
  });

  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  return { success: true };
}

export async function exportItemsCsvAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");

  const parsed = itemFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : {};
  const where = buildItemWhere(user.organizationId, { ...filters, page: 1, pageSize: 10000 });

  const items = await prisma.item.findMany({
    where,
    include: { category: true, unit: true },
    orderBy: { name: "asc" },
  });

  const csv = generateItemsCsv(items);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ITEM_EXPORTED",
    entityType: "Item",
    entityLabel: `${items.length} articles exportés`,
    newValues: { count: items.length },
  });

  return { success: true, csv, filename: "catalogue.csv" };
}

function parseSalesFilters(searchParams: Record<string, string | undefined>): ItemSalesFilters {
  return {
    from: searchParams.from ? new Date(searchParams.from) : undefined,
    to: searchParams.to ? new Date(`${searchParams.to}T23:59:59.999`) : undefined,
    customerId: searchParams.customerId || undefined,
    itemId: searchParams.itemId || undefined,
  };
}

export async function getItemSalesReportAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  return getItemSalesReportQuery(user.organizationId, parseSalesFilters(searchParams));
}

export async function getItemStockSummariesAction(itemIds: string[]) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  const items = await prisma.item.findMany({
    where: { organizationId: user.organizationId, id: { in: itemIds } },
    select: {
      id: true,
      isStockable: true,
      stockQuantity: true,
      purchasePriceExcludingTax: true,
      salePriceExcludingTax: true,
      unit: { select: { symbol: true } },
    },
  });
  return getItemStockSummariesQuery(user.organizationId, items);
}

export async function exportItemSalesCsvAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_READ");
  const report = await getItemSalesReportQuery(user.organizationId, parseSalesFilters(searchParams));
  const header = "Produit;SKU;Quantite;CA HT;CA TTC;Marge\n";
  const rows = report.rows
    .map((row) =>
      [
        row.name,
        row.sku ?? "",
        row.quantitySold,
        row.revenueExcludingTax,
        row.revenueIncludingTax,
        row.marginAmount,
      ].join(";"),
    )
    .join("\n");
  return { success: true as const, csv: header + rows, filename: "ventes-produits.csv" };
}
