import { describe, expect, it } from "vitest";
import { generateInvoicesCsv, INVOICE_CSV_HEADERS } from "@/lib/csv";

describe("invoice CSV export", () => {
  it("génère headers", () => {
    expect(generateInvoicesCsv([]).split("\n")[0]).toBe(INVOICE_CSV_HEADERS.join(","));
  });
  it("inclut quoteNumber", () => {
    const csv = generateInvoicesCsv([{
      invoiceNumber: "FAC-2026-0001",
      type: "STANDARD",
      status: "DRAFT",
      paymentStatus: "UNPAID",
      issueDate: new Date("2026-01-01"),
      dueDate: new Date("2026-01-31"),
      currency: "EUR",
      subtotalExcludingTax: 100,
      totalDiscountAmount: 0,
      totalExcludingTax: 100,
      totalVatAmount: 20,
      totalIncludingTax: 120,
      amountPaid: 0,
      amountDue: 120,
      createdAt: new Date(),
      customer: { name: "Client Demo" },
      quote: { quoteNumber: "DEV-2026-0001" },
    }]);
    expect(csv).toContain("DEV-2026-0001");
  });
});
