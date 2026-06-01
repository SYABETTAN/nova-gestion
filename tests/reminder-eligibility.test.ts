import { describe, expect, it } from "vitest";
import { getDaysOverdue, shouldInvoiceBeReminded } from "@/lib/collection-utils";

describe("reminder eligibility", () => {
  const base = {
    status: "OVERDUE" as const,
    paymentStatus: "OVERDUE" as const,
    amountDue: 100,
    dueDate: new Date(Date.now() - 86400000 * 10),
  };

  it("Une facture payée n'est pas éligible", () => {
    expect(shouldInvoiceBeReminded({ ...base, status: "PAID", amountDue: 0 })).toBe(false);
  });

  it("Une facture annulée n'est pas éligible", () => {
    expect(shouldInvoiceBeReminded({ ...base, status: "CANCELLED" })).toBe(false);
  });

  it("Une facture créditée n'est pas éligible", () => {
    expect(shouldInvoiceBeReminded({ ...base, status: "CREDITED" })).toBe(false);
  });

  it("Une facture non échue n'est pas éligible", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(shouldInvoiceBeReminded({ ...base, dueDate: future })).toBe(false);
    expect(getDaysOverdue(future)).toBe(0);
  });

  it("Une facture overdue avec amountDue > 0 est éligible", () => {
    expect(shouldInvoiceBeReminded(base)).toBe(true);
  });

  it("Une facture en pause n'est pas éligible par défaut", () => {
    expect(shouldInvoiceBeReminded({ ...base, isCollectionPaused: true })).toBe(false);
  });

  it("Une facture en litige n'est pas éligible par défaut", () => {
    expect(shouldInvoiceBeReminded({ ...base, isDisputed: true })).toBe(false);
  });
});
