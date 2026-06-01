import { describe, expect, it } from "vitest";
import {
  cancelPaymentSchema,
  createPaymentSchema,
  paymentAllocationInputSchema,
} from "@/lib/payment-validators";

describe("payment validation", () => {
  it("customerId est obligatoire", () => {
    const result = createPaymentSchema.safeParse({
      paymentDate: new Date(),
      amount: 100,
      method: "BANK_TRANSFER",
    });
    expect(result.success).toBe(false);
  });

  it("amount doit être > 0", () => {
    const result = createPaymentSchema.safeParse({
      customerId: "c1",
      paymentDate: new Date(),
      amount: 0,
      method: "BANK_TRANSFER",
    });
    expect(result.success).toBe(false);
  });

  it("method est obligatoire", () => {
    const result = createPaymentSchema.safeParse({
      customerId: "c1",
      paymentDate: new Date(),
      amount: 100,
    });
    expect(result.success).toBe(false);
  });

  it("cardLast4 doit faire 4 caractères", () => {
    const result = createPaymentSchema.safeParse({
      customerId: "c1",
      paymentDate: new Date(),
      amount: 100,
      method: "CARD",
      cardLast4: "12",
    });
    expect(result.success).toBe(false);
  });

  it("cancellationReason est obligatoire pour annulation", () => {
    const result = cancelPaymentSchema.safeParse({ paymentId: "p1", reason: "ab" });
    expect(result.success).toBe(false);
  });

  it("allocation amount > 0", () => {
    const result = paymentAllocationInputSchema.safeParse({ invoiceId: "i1", amount: -1 });
    expect(result.success).toBe(false);
  });
});
