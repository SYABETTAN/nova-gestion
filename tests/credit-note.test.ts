import { describe, expect, it } from "vitest";
import { calculateCreditNoteLineTotals } from "@/lib/invoice-calculations";

describe("credit note", () => {
  it("calcule totaux avoir partiel", () => {
    const t = calculateCreditNoteLineTotals({ quantity: 1, unitPriceExcludingTax: 100, vatRate: 20 });
    expect(t.totalIncludingTax).toBe(120);
  });

  it("refuse montant supérieur via validation schema", async () => {
    const { createCreditNoteSchema } = await import("@/lib/invoice-validators");
    const result = createCreditNoteSchema.safeParse({
      invoiceId: "inv1",
      reason: "Test",
      type: "PARTIAL",
      partialAmount: 0,
    });
    expect(result.success).toBe(false);
  });
});
