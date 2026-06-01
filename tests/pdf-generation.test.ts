import { describe, expect, it } from "vitest";
import { generateInvoicePdfBuffer } from "@/lib/pdf/invoice-pdf";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote-pdf";

describe("PDF generation", () => {
  it("génère un PDF facture non vide", async () => {
    const buffer = await generateInvoicePdfBuffer({
      invoiceNumber: "FAC-2025-001",
      title: "Prestation",
      issueDate: new Date("2025-01-15"),
      dueDate: new Date("2025-02-15"),
      currency: "EUR",
      customerName: "Client Test",
      organizationName: "Org Test",
      lines: [
        {
          name: "Ligne 1",
          quantity: 1,
          unitPriceExcludingTax: 100,
          totalExcludingTax: 100,
          vatRate: 20,
        },
      ],
      totalExcludingTax: 100,
      totalVatAmount: 20,
      totalIncludingTax: 120,
      amountDue: 120,
    });

    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("génère un PDF devis non vide", async () => {
    const buffer = await generateQuotePdfBuffer({
      quoteNumber: "DEV-2025-001",
      title: "Devis test",
      issueDate: new Date("2025-01-10"),
      validUntil: new Date("2025-02-10"),
      currency: "EUR",
      customerName: "Client Test",
      organizationName: "Org Test",
      lines: [
        {
          name: "Prestation",
          quantity: 2,
          unitPriceExcludingTax: 50,
          totalExcludingTax: 100,
        },
      ],
      totalExcludingTax: 100,
      totalVatAmount: 20,
      totalIncludingTax: 120,
    });

    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
