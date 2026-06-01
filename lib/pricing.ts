import {
  calculatePriceIncludingTax as calcPriceTtc,
  money,
  moneySub,
  moneyToNumber,
  roundMoney as roundMoneyDecimal,
  roundRate,
  type MoneyInput,
} from "@/lib/money";

/** Arrondi monétaire — retourne un number pour affichage / compatibilité UI. */
export function roundMoney(value: MoneyInput): number {
  return moneyToNumber(roundMoneyDecimal(value));
}

export { moneyToNumber, type MoneyInput } from "@/lib/money";

export function calculatePriceIncludingTax(
  priceExcludingTax: MoneyInput,
  vatRate: MoneyInput,
): number {
  return moneyToNumber(calcPriceTtc(priceExcludingTax, vatRate));
}

export function calculateMarginAmount(
  salePriceExcludingTax: MoneyInput,
  purchasePriceExcludingTax: MoneyInput,
): number {
  return moneyToNumber(moneySub(salePriceExcludingTax, purchasePriceExcludingTax));
}

export function calculateMarginRate(
  salePriceExcludingTax: MoneyInput,
  purchasePriceExcludingTax: MoneyInput,
): number {
  const sale = roundMoneyDecimal(salePriceExcludingTax);
  if (sale.lessThanOrEqualTo(0)) return 0;
  const margin = moneySub(sale, purchasePriceExcludingTax);
  return moneyToNumber(roundRate(margin.dividedBy(sale).times(100)));
}

export function computeItemPricing(input: {
  salePriceExcludingTax: MoneyInput;
  purchasePriceExcludingTax: MoneyInput;
  defaultVatRate: MoneyInput;
}) {
  const salePriceIncludingTax = calculatePriceIncludingTax(
    input.salePriceExcludingTax,
    input.defaultVatRate,
  );
  const marginAmount = calculateMarginAmount(
    input.salePriceExcludingTax,
    input.purchasePriceExcludingTax,
  );
  const marginRate = calculateMarginRate(
    input.salePriceExcludingTax,
    input.purchasePriceExcludingTax,
  );

  return {
    salePriceIncludingTax,
    marginAmount,
    marginRate,
  };
}

export function formatCurrency(amount: MoneyInput, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(moneyToNumber(amount));
}

export function formatVatRate(rate: MoneyInput): string {
  return `${moneyToNumber(roundRate(rate))} %`;
}

export function getMarginBadgeVariant(marginRate: number): "low" | "high" | "normal" | "negative" {
  if (marginRate < 0) return "negative";
  if (marginRate < 15) return "low";
  if (marginRate > 50) return "high";
  return "normal";
}
