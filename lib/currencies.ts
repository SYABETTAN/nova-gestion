import type { CurrencySetting } from "@prisma/client";

export function validateCurrencyCode(code: string): boolean {
  return code.length === 3;
}

export function validateExchangeRate(rate: number): boolean {
  return rate > 0;
}

export function filterActiveCurrencies(currencies: CurrencySetting[]): CurrencySetting[] {
  return currencies.filter((c) => c.isActive);
}

export function pickDefaultCurrency(currencies: CurrencySetting[]): CurrencySetting | undefined {
  const active = filterActiveCurrencies(currencies);
  return active.find((c) => c.isDefault) ?? active[0];
}
