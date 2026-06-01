import { describe, expect, it } from "vitest";
import { createQuoteSchema } from "@/lib/quote-validators";

const validLine = {
  lineType: "ITEM" as const,
  position: 0,
  name: "Prestation test",
  quantity: 1,
  unit: "unité",
  unitPriceExcludingTax: 100,
  discountValue: 0,
  vatRate: 20,
};

describe("quote validation", () => {
  it("customerId est obligatoire", () => {
    const result = createQuoteSchema.safeParse({
      customerId: "",
      title: "Devis test",
      issueDate: new Date("2026-01-01"),
      validUntil: new Date("2026-01-31"),
      lines: [validLine],
    });
    expect(result.success).toBe(false);
  });

  it("title est obligatoire", () => {
    const result = createQuoteSchema.safeParse({
      customerId: "cust-1",
      title: "A",
      issueDate: new Date("2026-01-01"),
      validUntil: new Date("2026-01-31"),
      lines: [validLine],
    });
    expect(result.success).toBe(false);
  });

  it("validUntil doit être après ou égal à issueDate", () => {
    const result = createQuoteSchema.safeParse({
      customerId: "cust-1",
      title: "Devis test",
      issueDate: new Date("2026-02-01"),
      validUntil: new Date("2026-01-01"),
      lines: [validLine],
    });
    expect(result.success).toBe(false);
  });

  it("au moins une ligne facturable est requise", () => {
    const result = createQuoteSchema.safeParse({
      customerId: "cust-1",
      title: "Devis test",
      issueDate: new Date("2026-01-01"),
      validUntil: new Date("2026-01-31"),
      lines: [{ ...validLine, lineType: "SECTION" }],
    });
    expect(result.success).toBe(false);
  });

  it("discount percentage > 100 est refusé", () => {
    const result = createQuoteSchema.safeParse({
      customerId: "cust-1",
      title: "Devis test",
      issueDate: new Date("2026-01-01"),
      validUntil: new Date("2026-01-31"),
      lines: [{ ...validLine, discountType: "PERCENTAGE", discountValue: 150 }],
    });
    expect(result.success).toBe(false);
  });
});
