import { describe, expect, it } from "vitest";
import { createItemSchema } from "@/lib/item-validators";

describe("item validation", () => {
  const valid = {
    name: "Test Article",
    type: "SERVICE",
    status: "ACTIVE",
    salePriceExcludingTax: 100,
    purchasePriceExcludingTax: 50,
    defaultVatRate: 20,
    currency: "EUR",
    isRecurring: false,
    isStockable: false,
    stockQuantity: 0,
    stockAlertThreshold: 0,
  };

  it("name est obligatoire", () => {
    expect(createItemSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
  });

  it("salePriceExcludingTax négatif est refusé", () => {
    expect(createItemSchema.safeParse({ ...valid, salePriceExcludingTax: -1 }).success).toBe(false);
  });

  it("purchasePriceExcludingTax négatif est refusé", () => {
    expect(createItemSchema.safeParse({ ...valid, purchasePriceExcludingTax: -5 }).success).toBe(false);
  });

  it("defaultVatRate > 100 est refusé", () => {
    expect(createItemSchema.safeParse({ ...valid, defaultVatRate: 150 }).success).toBe(false);
  });

  it("Si isRecurring true, recurringInterval est requis", () => {
    expect(createItemSchema.safeParse({ ...valid, isRecurring: true }).success).toBe(false);
    expect(
      createItemSchema.safeParse({ ...valid, isRecurring: true, recurringInterval: "MONTHLY" }).success,
    ).toBe(true);
  });

  it("currency par défaut est EUR", () => {
    const r = createItemSchema.safeParse({ name: "Test Article" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.currency).toBe("EUR");
  });
});
