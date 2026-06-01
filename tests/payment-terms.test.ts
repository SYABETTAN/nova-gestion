import { describe, expect, it } from "vitest";
import {
  filterActivePaymentTerms,
  pickDefaultPaymentTerm,
  validatePaymentTermDays,
} from "@/lib/payment-terms";
import { createPaymentTermSchema } from "@/lib/settings-validators";

const base = {
  id: "1",
  organizationId: "org",
  name: "30 jours",
  days: 30,
  description: null,
  isDefault: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("payment terms", () => {
  it("refuse days < 0", () => {
    expect(validatePaymentTermDays(-1)).toBe(false);
    expect(createPaymentTermSchema.safeParse({ name: "X", days: -1 }).success).toBe(false);
  });

  it("refuse days > 120", () => {
    expect(validatePaymentTermDays(121)).toBe(false);
    expect(createPaymentTermSchema.safeParse({ name: "X", days: 121 }).success).toBe(false);
  });

  it("définit une condition par défaut", () => {
    const terms = [
      { ...base, isDefault: false, isActive: true },
      { ...base, id: "2", isDefault: true, isActive: true },
    ];
    expect(pickDefaultPaymentTerm(terms)?.id).toBe("2");
  });

  it("désactive une condition", () => {
    const terms = [{ ...base, isActive: false }];
    expect(filterActivePaymentTerms(terms)).toHaveLength(0);
  });
});
