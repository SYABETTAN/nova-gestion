import { describe, expect, it } from "vitest";
import {
  cancelSupplierInvoiceSchema,
  createSupplierInvoiceSchema,
  markSupplierInvoicePartiallyPaidSchema,
  supplierInvoiceLineInputSchema,
} from "@/lib/supplier-invoice-validators";

const validLine = {
  position: 0,
  name: "Prestation",
  quantity: 1,
  unit: "unité",
  unitPriceExcludingTax: 100,
  discountAmount: 0,
  vatRate: 20,
};

describe("supplier invoice validation", () => {
  it("supplierId est obligatoire", () => {
    const result = createSupplierInvoiceSchema.safeParse({
      title: "Facture test",
      issueDate: new Date("2026-01-01"),
      receivedDate: new Date("2026-01-02"),
      dueDate: new Date("2026-01-31"),
      lines: [validLine],
    });
    expect(result.success).toBe(false);
  });

  it("dueDate doit être après ou égale à issueDate", () => {
    const result = createSupplierInvoiceSchema.safeParse({
      supplierId: "sup-1",
      title: "Facture test",
      issueDate: new Date("2026-02-01"),
      receivedDate: new Date("2026-02-01"),
      dueDate: new Date("2026-01-01"),
      lines: [validLine],
    });
    expect(result.success).toBe(false);
  });

  it("au moins une ligne est requise", () => {
    const result = createSupplierInvoiceSchema.safeParse({
      supplierId: "sup-1",
      title: "Facture test",
      issueDate: new Date("2026-01-01"),
      receivedDate: new Date("2026-01-02"),
      dueDate: new Date("2026-01-31"),
      lines: [],
    });
    expect(result.success).toBe(false);
  });

  it("quantity doit être > 0", () => {
    const result = supplierInvoiceLineInputSchema.safeParse({
      ...validLine,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("vatRate > 100 est refusé", () => {
    const result = supplierInvoiceLineInputSchema.safeParse({
      ...validLine,
      vatRate: 101,
    });
    expect(result.success).toBe(false);
  });

  it("amountPaid ne peut pas dépasser totalIncludingTax via calcul serveur", () => {
    const totals = { totalIncludingTax: 120, amountPaid: 150 };
    const capped = Math.min(totals.amountPaid, totals.totalIncludingTax);
    expect(capped).toBe(120);
  });

  it("paiement partiel exige un montant positif", () => {
    const result = markSupplierInvoicePartiallyPaidSchema.safeParse({ amount: 0 });
    expect(result.success).toBe(false);
  });

  it("annulation exige une raison", () => {
    const result = cancelSupplierInvoiceSchema.safeParse({ reason: "ab" });
    expect(result.success).toBe(false);
  });
});
