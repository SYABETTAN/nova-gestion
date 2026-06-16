import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canInvoiceReceivePayment, computeCustomerOutstanding, getInvoiceRemainingAmount } from "@/lib/payment-math";
import { invoicePaymentPrefillErrorMessage } from "@/lib/payment-prefill-messages";

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
    const source = readFileSync(resolve(process.cwd(), "lib/item-sales.ts"), "utf8");
    expect(source).toMatch(/SOLD_INVOICE_STATUSES/);
    expect(source).not.toMatch(/"DRAFT"/);
  });
});

describe("payment form client bundle", () => {
  it("n'importe pas payment-calculations (Prisma) côté client", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/payments/payment-form.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from "@\/lib\/payment-calculations"/);
    expect(source).toMatch(/from "@\/lib\/payment-math"/);
  });

  it("payment-math n'importe pas le client Prisma", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/payment-math.ts"), "utf8");
    expect(source).not.toMatch(/@\/lib\/prisma/);
    expect(source).not.toMatch(/PrismaClient/);
    expect(source).not.toMatch(/server-only/);
  });
});

describe("global search customer filter", () => {
  it("utilise une recherche insensible à la casse", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/search/search-service.ts"),
      "utf8",
    );
    expect(source).toMatch(/mode: "insensitive"/);
  });
});

describe("invoices client filter", () => {
  it("utilise CustomerFilterField avec recherche", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/invoices/invoices-page-client.tsx"),
      "utf8",
    );
    expect(source).toMatch(/CustomerFilterField/);
    expect(source).not.toMatch(/customers\.map\(\(c\)/);
  });
});
