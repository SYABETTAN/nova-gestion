import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  filterActiveCurrencies,
  pickDefaultCurrency,
  validateCurrencyCode,
  validateExchangeRate,
} from "@/lib/currencies";
import { createCurrencySchema } from "@/lib/settings-validators";

const base = {
  id: "1",
  organizationId: "org",
  code: "EUR",
  name: "Euro",
  symbol: "€",
  exchangeRateToDefault: new Prisma.Decimal(1),
  isDefault: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("currencies", () => {
  it("refuse code non 3 caractères", () => {
    expect(validateCurrencyCode("EU")).toBe(false);
    expect(createCurrencySchema.safeParse({ code: "EU", name: "Euro", symbol: "€", exchangeRateToDefault: 1 }).success).toBe(false);
  });

  it("refuse exchangeRateToDefault <= 0", () => {
    expect(validateExchangeRate(0)).toBe(false);
    expect(createCurrencySchema.safeParse({ code: "USD", name: "Dollar", symbol: "$", exchangeRateToDefault: 0 }).success).toBe(false);
  });

  it("définit une devise par défaut", () => {
    const currencies = [
      { ...base, isDefault: false },
      { ...base, id: "2", code: "USD", isDefault: true },
    ];
    expect(pickDefaultCurrency(currencies)?.code).toBe("USD");
  });

  it("masque les devises inactives", () => {
    expect(filterActiveCurrencies([{ ...base, isActive: false }])).toHaveLength(0);
  });
});
