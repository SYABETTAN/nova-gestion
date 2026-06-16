import { describe, expect, it } from "vitest";
import { canInvoiceReceivePayment, computeCustomerOutstanding, getInvoiceRemainingAmount } from "@/lib/payment-calculations";
import { invoicePaymentPrefillErrorMessage } from "@/lib/payment-prefill";
import { SOLD_INVOICE_STATUSES } from "@/lib/item-sales";
import { sumAmountDue } from "@/lib/customer-financials";

describe("payment prefill helpers", () => {
  it("messages d'erreur paiement facture", () => {
    expect(invoicePaymentPrefillErrorMessage("NOT_FOUND")).toContain("introuvable");
    expect(invoicePaymentPrefillErrorMessage("ALREADY_PAID")).toContain("payée");
    expect(invoicePaymentPrefillErrorMessage("ZERO_DUE")).toContain("montant");
  });
});

describe("invoice payment eligibility", () => {
  it("canInvoiceReceivePayment accepte les statuts ouverts", () => {
    expect(canInvoiceReceivePayment("VALIDATED")).toBe(true);
    expect(canInvoiceReceivePayment("PARTIALLY_PAID")).toBe(true);
    expect(canInvoiceReceivePayment("PAID")).toBe(false);
    expect(canInvoiceReceivePayment("DRAFT")).toBe(false);
  });

  it("calcule le reste à payer facture", () => {
    expect(getInvoiceRemainingAmount({ totalIncludingTax: 120, amountPaid: 20 })).toBe(100);
    expect(getInvoiceRemainingAmount({ totalIncludingTax: 120, amountPaid: 120 })).toBe(0);
  });
});

describe("customer financial totals", () => {
  it("somme les montants dus ouverts", () => {
    const due = sumAmountDue([
      { status: "SENT", amountDue: 100 },
      { status: "PAID", amountDue: 0 },
      { status: "DRAFT", amountDue: 50 },
    ]);
    expect(due).toBe(100);
  });

  it("computeCustomerOutstanding ignore brouillons et payées", () => {
    const outstanding = computeCustomerOutstanding([
      { status: "SENT", amountDue: 80 },
      { status: "PAID", amountDue: 0 },
      { status: "DRAFT", amountDue: 200 },
      { status: "CANCELLED", amountDue: 10 },
    ]);
    expect(outstanding).toBe(80);
  });
});

describe("item sales constants", () => {
  it("exclut les brouillons des ventes", () => {
    expect(SOLD_INVOICE_STATUSES).not.toContain("DRAFT");
    expect(SOLD_INVOICE_STATUSES).toContain("PAID");
    expect(SOLD_INVOICE_STATUSES).toContain("VALIDATED");
  });
});
