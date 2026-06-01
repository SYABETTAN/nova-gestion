import type { TaxRate } from "@prisma/client";

export function validateTaxRatePercent(rate: number): boolean {
  return rate >= 0 && rate <= 100;
}

export function filterActiveTaxRates(rates: TaxRate[]): TaxRate[] {
  return rates.filter((r) => r.isActive);
}

export function pickDefaultTaxRate(rates: TaxRate[]): TaxRate | undefined {
  const active = filterActiveTaxRates(rates);
  return active.find((r) => r.isDefault) ?? active[0];
}

export async function ensureSingleDefaultTaxRate(
  organizationId: string,
  selectedId: string,
  updateMany: (args: { where: { organizationId: string }; data: { isDefault: boolean } }) => Promise<unknown>,
  update: (args: { where: { id: string }; data: { isDefault: boolean; isActive: boolean } }) => Promise<unknown>,
) {
  await updateMany({ where: { organizationId }, data: { isDefault: false } });
  await update({ where: { id: selectedId }, data: { isDefault: true, isActive: true } });
}
