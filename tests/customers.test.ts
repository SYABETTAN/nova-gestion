import { describe, expect, it } from "vitest";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/customer-validators";

describe("customer validation", () => {
  const validBase = {
    name: "Test Client",
    type: "COMPANY",
    status: "PROSPECT",
    defaultPaymentTermsDays: 30,
    defaultVatRate: 20,
    currency: "EUR",
    creditLimit: 0,
    outstandingAmount: 0,
    country: "FR",
  };

  it("name est obligatoire", () => {
    const result = createCustomerSchema.safeParse({ ...validBase, name: "A" });
    expect(result.success).toBe(false);
  });

  it("email invalide est refusé", () => {
    const result = createCustomerSchema.safeParse({ ...validBase, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("defaultPaymentTermsDays > 120 est refusé", () => {
    const result = createCustomerSchema.safeParse({
      ...validBase,
      defaultPaymentTermsDays: 150,
    });
    expect(result.success).toBe(false);
  });

  it("creditLimit négatif est refusé", () => {
    const result = updateCustomerSchema.safeParse({
      ...validBase,
      creditLimit: -100,
    });
    expect(result.success).toBe(false);
  });

  it("currency par défaut est EUR", () => {
    const result = createCustomerSchema.safeParse({ name: "Test Client" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("EUR");
    }
  });
});
