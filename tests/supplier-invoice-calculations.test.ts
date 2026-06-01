import { describe, expect, it } from "vitest";
import {
  calculateSupplierInvoiceLineTotals,
  calculateSupplierInvoiceTotals,
} from "@/lib/supplier-invoice-calculations";

describe("supplier invoice calculations", () => {
  it("calcule total ligne sans remise", () => {
    const line = calculateSupplierInvoiceLineTotals({
      quantity: 2,
      unitPriceExcludingTax: 100,
      discountAmount: 0,
      vatRate: 20,
    });
    expect(line.totalExcludingTax).toBe(200);
    expect(line.totalVatAmount).toBe(40);
    expect(line.totalIncludingTax).toBe(240);
  });

  it("calcule total ligne avec remise montant", () => {
    const line = calculateSupplierInvoiceLineTotals({
      quantity: 1,
      unitPriceExcludingTax: 500,
      discountAmount: 50,
      vatRate: 20,
    });
    expect(line.totalExcludingTax).toBe(450);
    expect(line.totalIncludingTax).toBe(540);
  });

  it("calcule TVA", () => {
    const line = calculateSupplierInvoiceLineTotals({
      quantity: 1,
      unitPriceExcludingTax: 1000,
      discountAmount: 0,
      vatRate: 10,
    });
    expect(line.totalVatAmount).toBe(100);
  });

  it("calcule total facture fournisseur", () => {
    const totals = calculateSupplierInvoiceTotals([
      { quantity: 1, unitPriceExcludingTax: 100, discountAmount: 0, vatRate: 20 },
      { quantity: 2, unitPriceExcludingTax: 50, discountAmount: 10, vatRate: 20 },
    ]);
    expect(totals.subtotalExcludingTax).toBe(200);
    expect(totals.totalDiscountAmount).toBe(10);
    expect(totals.totalExcludingTax).toBe(190);
    expect(totals.totalVatAmount).toBe(38);
    expect(totals.totalIncludingTax).toBe(228);
  });

  it("calcule amountDue", () => {
    const totals = calculateSupplierInvoiceTotals(
      [{ quantity: 1, unitPriceExcludingTax: 100, discountAmount: 0, vatRate: 20 }],
      50,
    );
    expect(totals.amountDue).toBe(70);
  });

  it("empêche un total négatif", () => {
    const line = calculateSupplierInvoiceLineTotals({
      quantity: 1,
      unitPriceExcludingTax: 100,
      discountAmount: 200,
      vatRate: 20,
    });
    expect(line.totalExcludingTax).toBe(0);
    expect(line.totalIncludingTax).toBe(0);
  });

  it("arrondit à 2 décimales", () => {
    const line = calculateSupplierInvoiceLineTotals({
      quantity: 3,
      unitPriceExcludingTax: 33.33,
      discountAmount: 0,
      vatRate: 20,
    });
    expect(line.totalExcludingTax).toBe(99.99);
    expect(line.totalVatAmount).toBe(20);
    expect(line.totalIncludingTax).toBe(119.99);
  });
});
