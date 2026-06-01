import { describe, expect, it } from "vitest";
import {
  canCancelSupplierInvoice,
  canMarkSupplierInvoicePaid,
  canValidateSupplierInvoice,
  getSupplierInvoiceRemainingAmount,
  isSupplierInvoiceEditable,
  isSupplierInvoiceOverdue,
  recalculateSupplierInvoicePaymentStatus,
} from "@/lib/supplier-invoice-status";

describe("supplier invoice status", () => {
  it("DRAFT est modifiable", () => {
    expect(isSupplierInvoiceEditable("DRAFT")).toBe(true);
  });

  it("VALIDATED n'est pas modifiable", () => {
    expect(isSupplierInvoiceEditable("VALIDATED")).toBe(false);
  });

  it("DRAFT peut être validée", () => {
    expect(canValidateSupplierInvoice("DRAFT")).toBe(true);
  });

  it("VALIDATED peut être marquée payée placeholder", () => {
    expect(canMarkSupplierInvoicePaid("VALIDATED")).toBe(true);
  });

  it("CANCELLED ne peut pas être modifiée", () => {
    expect(isSupplierInvoiceEditable("CANCELLED")).toBe(false);
    expect(canCancelSupplierInvoice("CANCELLED")).toBe(false);
  });

  it("une facture en retard est détectée correctement", () => {
    const past = new Date("2020-01-01");
    expect(isSupplierInvoiceOverdue(past, 100, new Date("2026-01-01"))).toBe(true);
    expect(isSupplierInvoiceOverdue(past, 0, new Date("2026-01-01"))).toBe(false);
  });

  it("recalcule le statut payé", () => {
    expect(
      recalculateSupplierInvoicePaymentStatus({
        status: "VALIDATED",
        paymentStatus: "UNPAID",
        dueDate: new Date("2026-12-31"),
        totalIncludingTax: 120,
        amountPaid: 120,
        amountDue: 0,
      }),
    ).toBe("PAID");
  });

  it("calcule le reste à payer", () => {
    expect(getSupplierInvoiceRemainingAmount({ totalIncludingTax: 200, amountPaid: 50 })).toBe(150);
  });
});
