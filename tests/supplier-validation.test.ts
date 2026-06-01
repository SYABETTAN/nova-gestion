import { describe, expect, it } from "vitest";
import { createSupplierSchema } from "@/lib/supplier-validators";

describe("supplier validation", () => {
  it("name est obligatoire", () => {
    const result = createSupplierSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("email invalide est refusé", () => {
    const result = createSupplierSchema.safeParse({
      name: "Test Fournisseur",
      email: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("defaultPaymentTermsDays > 120 est refusé", () => {
    const result = createSupplierSchema.safeParse({
      name: "Test Fournisseur",
      defaultPaymentTermsDays: 150,
    });
    expect(result.success).toBe(false);
  });

  it("outstandingAmount négatif est refusé", () => {
    const result = createSupplierSchema.safeParse({
      name: "Test Fournisseur",
      outstandingAmount: -10,
    });
    expect(result.success).toBe(false);
  });

  it("currency par défaut est EUR", () => {
    const result = createSupplierSchema.safeParse({ name: "Test Fournisseur" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe("EUR");
  });
});
