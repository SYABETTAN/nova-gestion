import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  filterActiveTaxRates,
  pickDefaultTaxRate,
  validateTaxRatePercent,
} from "@/lib/tax-rates";
import { createTaxRateSchema } from "@/lib/settings-validators";

const base = {
  id: "1",
  organizationId: "org",
  name: "TVA 20 %",
  rate: new Prisma.Decimal(20),
  type: "VAT" as const,
  country: "FR",
  isDefault: false,
  isActive: true,
  description: null,
  accountingCollectedAccountId: null,
  accountingDeductibleAccountId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("tax rates", () => {
  it("refuse un taux < 0", () => {
    expect(validateTaxRatePercent(-1)).toBe(false);
    expect(createTaxRateSchema.safeParse({ name: "X", rate: -1 }).success).toBe(false);
  });

  it("refuse un taux > 100", () => {
    expect(validateTaxRatePercent(101)).toBe(false);
    expect(createTaxRateSchema.safeParse({ name: "X", rate: 101 }).success).toBe(false);
  });

  it("définit un seul taux par défaut", () => {
    const rates = [
      { ...base, id: "a", isDefault: true },
      { ...base, id: "b", isDefault: false },
    ];
    expect(pickDefaultTaxRate(rates)?.id).toBe("a");
  });

  it("masque les taux inactifs", () => {
    const rates = [
      { ...base, isActive: true },
      { ...base, id: "2", isActive: false },
    ];
    expect(filterActiveTaxRates(rates)).toHaveLength(1);
  });
});
