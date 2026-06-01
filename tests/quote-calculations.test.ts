import { describe, expect, it } from "vitest";
import {
  calculateDiscountAmount,
  calculateQuoteLineTotals,
  calculateQuoteTotals,
  isBillableLineType,
} from "@/lib/quote-calculations";

describe("quote calculations", () => {
  it("calcule total ligne sans remise", () => {
    const line = calculateQuoteLineTotals({
      lineType: "ITEM",
      quantity: 2,
      unitPriceExcludingTax: 100,
      discountType: null,
      discountValue: 0,
      vatRate: 20,
    });
    expect(line.totalExcludingTax).toBe(200);
    expect(line.totalVatAmount).toBe(40);
    expect(line.totalIncludingTax).toBe(240);
  });

  it("calcule total ligne avec remise pourcentage", () => {
    const line = calculateQuoteLineTotals({
      lineType: "SERVICE",
      quantity: 1,
      unitPriceExcludingTax: 1000,
      discountType: "PERCENTAGE",
      discountValue: 10,
      vatRate: 20,
    });
    expect(line.discountAmount).toBe(100);
    expect(line.totalExcludingTax).toBe(900);
    expect(line.totalVatAmount).toBe(180);
  });

  it("calcule total ligne avec remise montant fixe", () => {
    const line = calculateQuoteLineTotals({
      lineType: "ITEM",
      quantity: 3,
      unitPriceExcludingTax: 50,
      discountType: "FIXED_AMOUNT",
      discountValue: 30,
      vatRate: 20,
    });
    expect(line.discountAmount).toBe(30);
    expect(line.totalExcludingTax).toBe(120);
  });

  it("ignore les sections et commentaires", () => {
    expect(isBillableLineType("SECTION")).toBe(false);
    expect(isBillableLineType("COMMENT")).toBe(false);
    const line = calculateQuoteLineTotals({
      lineType: "SECTION",
      quantity: 1,
      unitPriceExcludingTax: 500,
      discountType: null,
      discountValue: 0,
      vatRate: 20,
    });
    expect(line.totalExcludingTax).toBe(0);
  });

  it("calcule total devis", () => {
    const totals = calculateQuoteTotals({
      lines: [
        {
          lineType: "ITEM",
          quantity: 2,
          unitPriceExcludingTax: 100,
          discountType: null,
          discountValue: 0,
          vatRate: 20,
        },
        {
          lineType: "SERVICE",
          quantity: 1,
          unitPriceExcludingTax: 200,
          discountType: "PERCENTAGE",
          discountValue: 10,
          vatRate: 20,
        },
      ],
      globalDiscountType: null,
      globalDiscountValue: 0,
      shippingAmountExcludingTax: 25,
      otherFeesExcludingTax: 0,
    });
    expect(totals.subtotalExcludingTax).toBe(400);
    expect(totals.totalExcludingTax).toBeGreaterThan(0);
    expect(totals.totalIncludingTax).toBeGreaterThan(totals.totalExcludingTax);
  });

  it("arrondit à 2 décimales", () => {
    const amount = calculateDiscountAmount(33.33, "PERCENTAGE", 33.33);
    expect(amount).toBe(11.11);
  });

  it("empêche remise fixe supérieure au montant de base", () => {
    const amount = calculateDiscountAmount(50, "FIXED_AMOUNT", 100);
    expect(amount).toBe(50);
  });
});
