import { describe, expect, it } from "vitest";
import { calculateInvoiceLineTotals, calculateInvoiceTotals } from "@/lib/invoice-calculations";

describe("invoice calculations", () => {
  it("calcule amountDue", () => {
    const totals = calculateInvoiceTotals({
      lines: [{ lineType: "ITEM", quantity: 1, unitPriceExcludingTax: 100, discountValue: 0, vatRate: 20 }],
      globalDiscountValue: 0,
      shippingAmountExcludingTax: 0,
      otherFeesExcludingTax: 0,
      amountPaid: 50,
    });
    expect(totals.amountDue).toBe(70);
  });

  it("calcule total ligne avec remise", () => {
    const line = calculateInvoiceLineTotals({
      lineType: "SERVICE",
      quantity: 2,
      unitPriceExcludingTax: 100,
      discountType: "PERCENTAGE",
      discountValue: 10,
      vatRate: 20,
    });
    expect(line.totalExcludingTax).toBe(180);
  });

  it("ignore sections", () => {
    const totals = calculateInvoiceTotals({
      lines: [
        { lineType: "ITEM", quantity: 1, unitPriceExcludingTax: 100, discountValue: 0, vatRate: 20 },
        { lineType: "SECTION", quantity: 1, unitPriceExcludingTax: 999, discountValue: 0, vatRate: 20 },
      ],
      globalDiscountValue: 0,
      shippingAmountExcludingTax: 0,
      otherFeesExcludingTax: 0,
    });
    expect(totals.totalIncludingTax).toBe(120);
  });
});
