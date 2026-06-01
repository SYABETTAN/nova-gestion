import { describe, expect, it } from "vitest";
import { createInvoiceSchema } from "@/lib/invoice-validators";

const line = {
  lineType: "ITEM" as const,
  position: 0,
  name: "Prestation",
  quantity: 1,
  unit: "unité",
  unitPriceExcludingTax: 100,
  discountValue: 0,
  vatRate: 20,
};

describe("invoice validation", () => {
  it("customerId obligatoire", () => {
    expect(createInvoiceSchema.safeParse({ customerId: "", title: "Test", issueDate: new Date(), dueDate: new Date(), lines: [line] }).success).toBe(false);
  });
  it("dueDate >= issueDate", () => {
    expect(createInvoiceSchema.safeParse({
      customerId: "c1", title: "Test facture", issueDate: new Date("2026-02-01"), dueDate: new Date("2026-01-01"), lines: [line],
    }).success).toBe(false);
  });
  it("ligne facturable requise", () => {
    expect(createInvoiceSchema.safeParse({
      customerId: "c1", title: "Test facture", issueDate: new Date("2026-01-01"), dueDate: new Date("2026-02-01"), lines: [{ ...line, lineType: "SECTION" }],
    }).success).toBe(false);
  });
});
