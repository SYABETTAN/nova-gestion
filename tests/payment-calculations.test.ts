import { describe, expect, it } from "vitest";
import {
  buildAutoAllocations,
  computeCustomerOutstanding,
  computeInvoicePaymentFields,
  getInvoiceRemainingAmount,
  getPaymentRemainingAmount,
} from "@/lib/payment-math";

describe("payment calculations", () => {
  it("calcule le reste dû facture", () => {
    expect(getInvoiceRemainingAmount({ totalIncludingTax: 1200, amountPaid: 500 })).toBe(700);
  });

  it("calcule le montant non alloué paiement", () => {
    expect(getPaymentRemainingAmount({ amount: 1000, allocatedAmount: 600 })).toBe(400);
  });

  it("facture totalement payée devient PAID", () => {
    const result = computeInvoicePaymentFields(
      { totalIncludingTax: 1000, dueDate: new Date("2026-06-01"), status: "SENT" },
      1000,
      new Date("2026-05-01"),
    );
    expect(result.paymentStatus).toBe("PAID");
    expect(result.status).toBe("PAID");
    expect(result.amountDue).toBe(0);
  });

  it("facture partiellement payée", () => {
    const result = computeInvoicePaymentFields(
      { totalIncludingTax: 1000, dueDate: new Date("2026-06-01"), status: "SENT" },
      400,
      new Date("2026-05-01"),
    );
    expect(result.paymentStatus).toBe("PARTIALLY_PAID");
    expect(result.amountDue).toBe(600);
  });

  it("facture échue impayée devient OVERDUE", () => {
    const result = computeInvoicePaymentFields(
      { totalIncludingTax: 1000, dueDate: new Date("2026-01-01"), status: "SENT" },
      0,
      new Date("2026-05-01"),
    );
    expect(result.paymentStatus).toBe("OVERDUE");
  });

  it("allocation automatique par échéance", () => {
    const allocations = buildAutoAllocations(1500, [
      { id: "a", dueDate: new Date("2026-03-01"), issueDate: new Date("2026-02-01"), totalIncludingTax: 800, amountPaid: 0 },
      { id: "b", dueDate: new Date("2026-04-01"), issueDate: new Date("2026-03-01"), totalIncludingTax: 1000, amountPaid: 0 },
    ]);
    expect(allocations).toHaveLength(2);
    expect(allocations[0].invoiceId).toBe("a");
    expect(allocations[0].amount).toBe(800);
    expect(allocations[1].amount).toBe(700);
  });

  it("calcule encours client", () => {
    const outstanding = computeCustomerOutstanding([
      { status: "SENT", amountDue: 500 },
      { status: "PAID", amountDue: 0 },
      { status: "CANCELLED", amountDue: 200 },
      { status: "OVERDUE", amountDue: 300 },
    ]);
    expect(outstanding).toBe(800);
  });
});
