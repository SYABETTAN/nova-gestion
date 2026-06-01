import { describe, expect, it } from "vitest";
import {
  SUPPLIER_INVOICE_CSV_HEADERS,
  generateSupplierInvoicesCsv,
} from "@/lib/csv";

describe("supplier invoice CSV export", () => {
  it("génère un CSV avec headers", () => {
    const csv = generateSupplierInvoicesCsv([]);
    expect(csv.split("\n")[0]).toBe(SUPPLIER_INVOICE_CSV_HEADERS.join(","));
  });

  it("inclut les champs attendus", () => {
    const csv = generateSupplierInvoicesCsv([
      {
        supplierInvoiceNumber: "ACH-2026-0001",
        supplierReference: "FAC-001",
        status: "VALIDATED",
        paymentStatus: "UNPAID",
        type: "STANDARD",
        issueDate: new Date("2026-01-15"),
        receivedDate: new Date("2026-01-16"),
        dueDate: new Date("2026-02-15"),
        currency: "EUR",
        subtotalExcludingTax: 1000,
        totalDiscountAmount: 0,
        totalExcludingTax: 1000,
        totalVatAmount: 200,
        totalIncludingTax: 1200,
        amountPaid: 0,
        amountDue: 1200,
        createdAt: new Date("2026-01-16T10:00:00Z"),
        supplier: { name: "Fournisseur Demo" },
        expenseCategory: { name: "Logiciels" },
      },
    ]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain("ACH-2026-0001");
    expect(lines[1]).toContain("Fournisseur Demo");
    expect(lines[1]).toContain("Logiciels");
  });

  it("échappe correctement les virgules et guillemets", () => {
    const csv = generateSupplierInvoicesCsv([
      {
        supplierInvoiceNumber: "ACH-2026-0002",
        supplierReference: 'REF "special", test',
        status: "DRAFT",
        paymentStatus: "UNPAID",
        type: "STANDARD",
        issueDate: new Date("2026-01-01"),
        receivedDate: new Date("2026-01-01"),
        dueDate: new Date("2026-01-31"),
        currency: "EUR",
        subtotalExcludingTax: 100,
        totalDiscountAmount: 0,
        totalExcludingTax: 100,
        totalVatAmount: 20,
        totalIncludingTax: 120,
        amountPaid: 0,
        amountDue: 120,
        createdAt: new Date("2026-01-01"),
        supplier: { name: "Société, SARL" },
        expenseCategory: null,
      },
    ]);
    expect(csv).toContain('"Société, SARL"');
    expect(csv).toContain('"REF ""special"", test"');
  });
});
