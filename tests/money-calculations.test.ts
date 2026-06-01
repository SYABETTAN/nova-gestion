import { describe, expect, it } from "vitest";
import {
  calculateAccountingEntryTotals,
  canValidateEntryTotals,
} from "@/lib/accounting-calculations";
import { calculateCreditNoteLineTotals, calculateInvoiceTotals } from "@/lib/invoice-calculations";
import {
  buildAutoAllocations,
  computeInvoicePaymentFields,
  getInvoiceRemainingAmount,
} from "@/lib/payment-calculations";
import {
  calculateQuoteLineTotals,
  calculateQuoteTotals,
  groupVatByRate,
} from "@/lib/quote-calculations";
import { moneyEq, moneyToNumber } from "@/lib/money";

describe("money — TVA", () => {
  it("calcule 100 × 20 %", () => {
    const line = calculateQuoteLineTotals({
      lineType: "ITEM",
      quantity: 1,
      unitPriceExcludingTax: 100,
      discountType: null,
      discountValue: 0,
      vatRate: 20,
    });
    expect(line.totalExcludingTax).toBe(100);
    expect(line.totalVatAmount).toBe(20);
    expect(line.totalIncludingTax).toBe(120);
  });

  it("calcule 99.99 × 20 % avec arrondi centime", () => {
    const line = calculateQuoteLineTotals({
      lineType: "ITEM",
      quantity: 1,
      unitPriceExcludingTax: 99.99,
      discountType: null,
      discountValue: 0,
      vatRate: 20,
    });
    expect(line.totalVatAmount).toBe(20);
    expect(line.totalIncludingTax).toBe(119.99);
  });

  it("calcule 0.01 × 20 %", () => {
    const line = calculateQuoteLineTotals({
      lineType: "ITEM",
      quantity: 1,
      unitPriceExcludingTax: 0.01,
      discountType: null,
      discountValue: 0,
      vatRate: 20,
    });
    expect(line.totalVatAmount).toBe(0);
    expect(line.totalIncludingTax).toBe(0.01);
  });

  it("agrège la TVA par taux sur plusieurs lignes", () => {
    const totals = calculateQuoteTotals({
      lines: [
        {
          lineType: "ITEM",
          quantity: 2,
          unitPriceExcludingTax: 50,
          discountType: null,
          discountValue: 0,
          vatRate: 20,
        },
        {
          lineType: "SERVICE",
          quantity: 1,
          unitPriceExcludingTax: 100,
          discountType: null,
          discountValue: 0,
          vatRate: 10,
        },
      ],
      globalDiscountType: null,
      globalDiscountValue: 0,
      shippingAmountExcludingTax: 0,
      otherFeesExcludingTax: 0,
    });
    const vatGroups = groupVatByRate(totals.lines);
    expect(vatGroups).toHaveLength(2);
    const vat20 = vatGroups.find((g) => g.vatRate === 20);
    expect(vat20?.vatAmount).toBe(20);
  });
});

describe("money — facturation", () => {
  it("applique une remise globale en pourcentage", () => {
    const totals = calculateQuoteTotals({
      lines: [
        {
          lineType: "ITEM",
          quantity: 1,
          unitPriceExcludingTax: 1000,
          discountType: null,
          discountValue: 0,
          vatRate: 20,
        },
      ],
      globalDiscountType: "PERCENTAGE",
      globalDiscountValue: 10,
      shippingAmountExcludingTax: 0,
      otherFeesExcludingTax: 0,
    });
    expect(totals.totalExcludingTax).toBe(900);
    expect(totals.totalVatAmount).toBe(180);
    expect(totals.totalIncludingTax).toBe(1080);
  });

  it("calcule les totaux facture avec reste à payer", () => {
    const invoice = calculateInvoiceTotals({
      lines: [
        {
          lineType: "ITEM",
          quantity: 1,
          unitPriceExcludingTax: 500,
          discountType: null,
          discountValue: 0,
          vatRate: 20,
        },
      ],
      globalDiscountType: null,
      globalDiscountValue: 0,
      shippingAmountExcludingTax: 0,
      otherFeesExcludingTax: 0,
      amountPaid: 200,
    });
    expect(invoice.totalIncludingTax).toBe(600);
    expect(invoice.amountDue).toBe(400);
  });

  it("calcule un avoir ligne par ligne", () => {
    const credit = calculateCreditNoteLineTotals({
      quantity: 2,
      unitPriceExcludingTax: 50,
      vatRate: 20,
    });
    expect(credit.totalExcludingTax).toBe(100);
    expect(credit.totalVatAmount).toBe(20);
    expect(credit.totalIncludingTax).toBe(120);
  });
});

describe("money — paiements", () => {
  it("gère un paiement complet", () => {
    const result = computeInvoicePaymentFields(
      { totalIncludingTax: 1200, dueDate: new Date("2026-12-01"), status: "SENT" },
      1200,
    );
    expect(result.paymentStatus).toBe("PAID");
    expect(result.amountDue).toBe(0);
  });

  it("gère un paiement partiel", () => {
    const result = computeInvoicePaymentFields(
      { totalIncludingTax: 1000, dueDate: new Date("2026-12-01"), status: "SENT" },
      250,
    );
    expect(result.paymentStatus).toBe("PARTIALLY_PAID");
    expect(result.amountDue).toBe(750);
  });

  it("gère plusieurs paiements via allocations automatiques", () => {
    const first = buildAutoAllocations(400, [
      {
        id: "inv-1",
        dueDate: new Date("2026-03-01"),
        issueDate: new Date("2026-02-01"),
        totalIncludingTax: 1000,
        amountPaid: 0,
      },
    ]);
    expect(first[0].amount).toBe(400);
    expect(getInvoiceRemainingAmount({ totalIncludingTax: 1000, amountPaid: 400 })).toBe(600);

    const second = buildAutoAllocations(600, [
      {
        id: "inv-1",
        dueDate: new Date("2026-03-01"),
        issueDate: new Date("2026-02-01"),
        totalIncludingTax: 1000,
        amountPaid: 400,
      },
    ]);
    expect(second[0].amount).toBe(600);
    expect(getInvoiceRemainingAmount({ totalIncludingTax: 1000, amountPaid: 1000 })).toBe(0);
  });
});

describe("money — comptabilité", () => {
  it("valide une écriture équilibrée débit/crédit", () => {
    const totals = calculateAccountingEntryTotals([
      { accountId: "a1", lineNumber: 0, label: "Client", debit: 120, credit: 0 },
      { accountId: "a2", lineNumber: 1, label: "Ventes HT", debit: 0, credit: 100 },
      { accountId: "a3", lineNumber: 2, label: "TVA", debit: 0, credit: 20 },
    ]);
    expect(totals.isBalanced).toBe(true);
    expect(canValidateEntryTotals(totals)).toBe(true);
  });

  it("rejette une écriture déséquilibrée", () => {
    const totals = calculateAccountingEntryTotals([
      { accountId: "a1", lineNumber: 0, label: "Débit", debit: 100, credit: 0 },
      { accountId: "a2", lineNumber: 1, label: "Crédit", debit: 0, credit: 99.99 },
    ]);
    expect(totals.isBalanced).toBe(false);
  });
});

describe("money — précision Decimal", () => {
  it("évite les erreurs float classiques (0.1 + 0.2)", () => {
    const totals = calculateQuoteTotals({
      lines: [
        {
          lineType: "ITEM",
          quantity: 3,
          unitPriceExcludingTax: 0.1,
          discountType: null,
          discountValue: 0,
          vatRate: 20,
        },
      ],
      globalDiscountType: null,
      globalDiscountValue: 0,
      shippingAmountExcludingTax: 0,
      otherFeesExcludingTax: 0,
    });
    expect(moneyEq(totals.totalExcludingTax, 0.3)).toBe(true);
  });
});
