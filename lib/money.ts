import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";

/** Précision d'arrondi monétaire (centimes). */
export const MONEY_SCALE = 2;

/** Précision stockée en base (4 décimales pour calculs intermédiaires). */
export const DB_MONEY_SCALE = 4;

/** Précision pour taux / pourcentages. */
export const RATE_SCALE = 4;

export type MoneyInput = Decimal | Prisma.Decimal | number | string | null | undefined;

/** Alias explicite pour les montants métier. */
export type Money = Decimal;

/** Crée un Decimal à partir de toute entrée (formulaire, Prisma, calcul). */
export function money(value: MoneyInput, fallback = "0"): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(fallback);
  }
  if (value instanceof Decimal) {
    return value;
  }
  if (value instanceof Prisma.Decimal) {
    return new Decimal(value.toString());
  }
  return new Decimal(value);
}

/** Convertit vers Prisma.Decimal pour écriture en base. */
export function toDbDecimal(value: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(money(value).toFixed(DB_MONEY_SCALE));
}

/** Arrondi bancaire au centime (half-up). */
export function roundMoney(value: MoneyInput): Decimal {
  return money(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

/** Arrondi taux / pourcentage. */
export function roundRate(value: MoneyInput): Decimal {
  return money(value).toDecimalPlaces(RATE_SCALE, Decimal.ROUND_HALF_UP);
}

/** Conversion affichage uniquement — ne pas utiliser dans les calculs intermédiaires. */
export function moneyToNumber(value: MoneyInput): number {
  return roundMoney(value).toNumber();
}

export function moneyEq(a: MoneyInput, b: MoneyInput): boolean {
  return roundMoney(a).equals(roundMoney(b));
}

export function isZero(value: MoneyInput): boolean {
  return roundMoney(value).isZero();
}

export function isPositive(value: MoneyInput): boolean {
  return roundMoney(value).greaterThan(0);
}

export function moneyAdd(a: MoneyInput, b: MoneyInput): Decimal {
  return roundMoney(money(a).plus(money(b)));
}

export function moneySub(a: MoneyInput, b: MoneyInput): Decimal {
  return roundMoney(money(a).minus(money(b)));
}

export function moneyMul(a: MoneyInput, b: MoneyInput): Decimal {
  return roundMoney(money(a).times(money(b)));
}

export function moneyDiv(a: MoneyInput, b: MoneyInput): Decimal {
  const divisor = money(b);
  if (divisor.isZero()) return new Decimal(0);
  return roundMoney(money(a).dividedBy(divisor));
}

export function moneyMax(a: MoneyInput, b: MoneyInput): Decimal {
  const ma = roundMoney(a);
  const mb = roundMoney(b);
  return ma.greaterThan(mb) ? ma : mb;
}

export function moneyMin(a: MoneyInput, b: MoneyInput): Decimal {
  const ma = roundMoney(a);
  const mb = roundMoney(b);
  return ma.lessThan(mb) ? ma : mb;
}

export function moneyClamp(value: MoneyInput, min: MoneyInput, max: MoneyInput): Decimal {
  return moneyMin(moneyMax(value, min), max);
}

/** TVA : base HT × taux % */
export function calculateVatAmount(baseExcludingTax: MoneyInput, vatRatePercent: MoneyInput): Decimal {
  return roundMoney(money(baseExcludingTax).times(money(vatRatePercent).dividedBy(100)));
}

/** Prix TTC à partir du HT et du taux TVA %. */
export function calculatePriceIncludingTax(
  priceExcludingTax: MoneyInput,
  vatRatePercent: MoneyInput,
): Decimal {
  return roundMoney(
    money(priceExcludingTax).times(new Decimal(1).plus(money(vatRatePercent).dividedBy(100))),
  );
}

/** Remise : pourcentage ou montant fixe plafonné à la base. */
export function calculateDiscountAmount(
  baseAmount: MoneyInput,
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | null | undefined,
  discountValue: MoneyInput,
): Decimal {
  const base = roundMoney(baseAmount);
  if (!discountType || isZero(discountValue) || !isPositive(base)) {
    return new Decimal(0);
  }

  if (discountType === "PERCENTAGE") {
    const pct = moneyClamp(discountValue, 0, 100);
    return roundMoney(base.times(pct.dividedBy(100)));
  }

  return roundMoney(moneyMin(discountValue, base));
}

/** Sérialisation JSON sûre (string, pas float IEEE). */
export function moneyToJson(value: MoneyInput): string {
  return roundMoney(value).toFixed(MONEY_SCALE);
}

/** Convertit récursivement les Decimal Prisma en number pour l'UI / JSON. */
export function serializeMoneyForClient<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) {
    return moneyToNumber(value) as T;
  }
  if (value instanceof Decimal) {
    return moneyToNumber(value) as T;
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item) => serializeMoneyForClient(item)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = serializeMoneyForClient(val);
    }
    return out as T;
  }
  return value;
}

/** Normalise une valeur Prisma/Decimal pour comparaisons dans les tests. */
export function expectMoney(value: MoneyInput): number {
  return moneyToNumber(value);
}

export { Decimal };
