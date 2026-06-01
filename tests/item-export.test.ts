import { describe, expect, it } from "vitest";
import { ITEM_CSV_HEADERS, escapeCsvValue, generateItemsCsv } from "@/lib/csv";

describe("item CSV export", () => {
  it("génère un CSV avec headers", () => {
    const csv = generateItemsCsv([]);
    expect(csv.split("\n")[0]).toBe(ITEM_CSV_HEADERS.join(","));
  });

  it("inclut les champs attendus", () => {
    const csv = generateItemsCsv([
      {
        itemNumber: "ART-0001",
        sku: "SKU-1",
        type: "SERVICE",
        status: "ACTIVE",
        name: 'Audit, "premium"',
        defaultVatRate: 20,
        salePriceExcludingTax: 500,
        salePriceIncludingTax: 600,
        purchasePriceExcludingTax: 200,
        marginAmount: 300,
        marginRate: 60,
        currency: "EUR",
        isRecurring: true,
        recurringInterval: "MONTHLY",
        isStockable: false,
        stockQuantity: 0,
        createdAt: new Date("2026-01-01"),
        category: { name: "Conseil" },
        unit: { symbol: "h" },
      },
    ]);
    expect(csv).toContain("ART-0001");
    expect(csv).toContain("Conseil");
    expect(csv).toContain('"Audit, ""premium"""');
  });

  it("échappe correctement les virgules et guillemets", () => {
    expect(escapeCsvValue('a, "b"')).toBe('"a, ""b"""');
  });
});
