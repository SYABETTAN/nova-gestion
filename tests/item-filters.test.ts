import { describe, expect, it } from "vitest";
import { computeItemStats, getItemStatusLabel, getItemTypeLabel } from "@/lib/item-utils";
import { filterItemsByCategory, filterItemsByTag, filterItemsByText } from "@/lib/items";

describe("item utilities", () => {
  it("getItemStatusLabel retourne le bon label", () => {
    expect(getItemStatusLabel("DRAFT")).toBe("Brouillon");
    expect(getItemStatusLabel("ACTIVE")).toBe("Actif");
  });

  it("getItemTypeLabel retourne le bon label", () => {
    expect(getItemTypeLabel("PRODUCT")).toBe("Produit");
    expect(getItemTypeLabel("SERVICE")).toBe("Service");
  });

  it("computeItemStats calcule les stats", () => {
    const stats = computeItemStats([
      { type: "PRODUCT", status: "ACTIVE", isArchived: false, salePriceExcludingTax: 100, marginRate: 40 },
      { type: "SERVICE", status: "ACTIVE", isArchived: false, salePriceExcludingTax: 200, marginRate: 60 },
      { type: "SERVICE", status: "ARCHIVED", isArchived: true, salePriceExcludingTax: 500, marginRate: 10 },
    ]);
    expect(stats.total).toBe(2);
    expect(stats.activeProducts).toBe(1);
    expect(stats.activeServices).toBe(1);
    expect(stats.averageSalePrice).toBe(150);
    expect(stats.averageMarginRate).toBe(50);
  });
});

describe("item filters", () => {
  const items = [
    { name: "Audit", itemNumber: "ART-0001", sku: "SKU-1", type: "SERVICE", status: "ACTIVE", categoryId: "c1", tagAssignments: [{ tagId: "t1" }] },
    { name: "Licence", itemNumber: "ART-0002", sku: "SKU-2", type: "PRODUCT", status: "DRAFT", categoryId: "c2", tagAssignments: [{ tagId: "t2" }] },
  ];

  it("filtre par type", () => {
    expect(filterItemsByText(items, { type: "PRODUCT" })).toHaveLength(1);
  });

  it("filtre par statut", () => {
    expect(filterItemsByText(items, { status: "DRAFT" })).toHaveLength(1);
  });

  it("filtre par catégorie", () => {
    expect(filterItemsByCategory(items, "c1")).toHaveLength(1);
  });

  it("filtre par texte", () => {
    expect(filterItemsByText(items, { q: "licence" })).toHaveLength(1);
  });

  it("filtre par tag", () => {
    expect(filterItemsByTag(items, "t1")).toHaveLength(1);
  });
});
