import { describe, expect, it } from "vitest";
import { computePaymentStatusFromAmounts } from "@/lib/payment-status";
import { getPaymentRemainingAmount } from "@/lib/payment-calculations";

describe("payment allocation status", () => {
  it("paiement non alloué est CONFIRMED", () => {
    expect(computePaymentStatusFromAmounts(1000, 0)).toBe("CONFIRMED");
  });

  it("paiement partiellement alloué", () => {
    expect(computePaymentStatusFromAmounts(1000, 400)).toBe("PARTIALLY_ALLOCATED");
  });

  it("paiement totalement alloué", () => {
    expect(computePaymentStatusFromAmounts(1000, 1000)).toBe("FULLY_ALLOCATED");
  });

  it("calcule unallocatedAmount", () => {
    expect(getPaymentRemainingAmount({ amount: 1000, allocatedAmount: 750 })).toBe(250);
  });

  it("refuse allocation supérieure au paiement via remaining", () => {
    const remaining = getPaymentRemainingAmount({ amount: 500, allocatedAmount: 400 });
    expect(200 > remaining).toBe(true);
  });
});
