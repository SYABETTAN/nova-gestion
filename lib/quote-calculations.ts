import type { DiscountType, QuoteLineType } from "@prisma/client";
import {
  calculateDiscountAmount as calcDiscount,
  calculateVatAmount,
  isZero,
  money,
  moneyAdd,
  moneyClamp,
  moneyDiv,
  moneyMul,
  moneySub,
  moneyToNumber,
  roundMoney,
  type MoneyInput,
} from "@/lib/money";

export type QuoteLineCalculationInput = {
  lineType: QuoteLineType;
  quantity: MoneyInput;
  unitPriceExcludingTax: MoneyInput;
  discountType?: DiscountType | null;
  discountValue: MoneyInput;
  vatRate: MoneyInput;
};

export type CalculatedQuoteLine = QuoteLineCalculationInput & {
  discountAmount: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
};

export type QuoteTotalsInput = {
  lines: QuoteLineCalculationInput[];
  globalDiscountType?: DiscountType | null;
  globalDiscountValue: MoneyInput;
  shippingAmountExcludingTax: MoneyInput;
  otherFeesExcludingTax: MoneyInput;
  defaultVatRate?: MoneyInput;
};

export type CalculatedQuoteTotals = {
  subtotalExcludingTax: number;
  lineDiscountAmount: number;
  globalDiscountAmount: number;
  totalDiscountAmount: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  lines: CalculatedQuoteLine[];
};

function toLineNumbers(line: QuoteLineCalculationInput, amounts: {
  discountAmount: ReturnType<typeof roundMoney>;
  totalExcludingTax: ReturnType<typeof roundMoney>;
  totalVatAmount: ReturnType<typeof roundMoney>;
  totalIncludingTax: ReturnType<typeof roundMoney>;
}): CalculatedQuoteLine {
  return {
    ...line,
    discountAmount: moneyToNumber(amounts.discountAmount),
    totalExcludingTax: moneyToNumber(amounts.totalExcludingTax),
    totalVatAmount: moneyToNumber(amounts.totalVatAmount),
    totalIncludingTax: moneyToNumber(amounts.totalIncludingTax),
  };
}

export function isBillableLineType(lineType: QuoteLineType): boolean {
  return lineType === "ITEM" || lineType === "SERVICE" || lineType === "FREE_TEXT";
}

export function calculateDiscountAmount(
  baseAmount: MoneyInput,
  discountType: DiscountType | null | undefined,
  discountValue: MoneyInput,
): number {
  return moneyToNumber(calcDiscount(baseAmount, discountType, discountValue));
}

export function calculateQuoteLineTotals(
  line: QuoteLineCalculationInput,
): CalculatedQuoteLine {
  if (!isBillableLineType(line.lineType)) {
    return toLineNumbers(line, {
      discountAmount: money(0),
      totalExcludingTax: money(0),
      totalVatAmount: money(0),
      totalIncludingTax: money(0),
    });
  }

  const baseLineAmount = roundMoney(moneyMul(line.quantity, line.unitPriceExcludingTax));
  const discountAmount = calcDiscount(baseLineAmount, line.discountType, line.discountValue);
  const totalExcludingTax = roundMoney(moneySub(baseLineAmount, discountAmount));
  const totalVatAmount = calculateVatAmount(totalExcludingTax, line.vatRate);
  const totalIncludingTax = roundMoney(moneyAdd(totalExcludingTax, totalVatAmount));

  return toLineNumbers(line, {
    discountAmount,
    totalExcludingTax,
    totalVatAmount,
    totalIncludingTax,
  });
}

export function groupVatByRate(
  lines: CalculatedQuoteLine[],
): { vatRate: number; baseAmount: number; vatAmount: number }[] {
  const map = new Map<string, { baseAmount: ReturnType<typeof roundMoney>; vatAmount: ReturnType<typeof roundMoney> }>();

  for (const line of lines) {
    if (!isBillableLineType(line.lineType)) continue;
    const key = money(line.vatRate).toFixed(4);
    const existing = map.get(key) ?? {
      baseAmount: money(0),
      vatAmount: money(0),
    };
    existing.baseAmount = roundMoney(moneyAdd(existing.baseAmount, line.totalExcludingTax));
    existing.vatAmount = roundMoney(moneyAdd(existing.vatAmount, line.totalVatAmount));
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .map(([rateKey, amounts]) => ({
      vatRate: moneyToNumber(rateKey),
      baseAmount: moneyToNumber(amounts.baseAmount),
      vatAmount: moneyToNumber(amounts.vatAmount),
    }))
    .sort((a, b) => b.vatRate - a.vatRate);
}

export function calculateQuoteTotals(input: QuoteTotalsInput): CalculatedQuoteTotals {
  const defaultVatRate = input.defaultVatRate ?? 20;
  const calculatedLines = input.lines.map(calculateQuoteLineTotals);

  const billableLines = calculatedLines.filter((l) => isBillableLineType(l.lineType));

  const subtotalExcludingTax = roundMoney(
    billableLines.reduce(
      (sum, l) => moneyAdd(sum, moneyMul(l.quantity, l.unitPriceExcludingTax)),
      money(0),
    ),
  );

  const lineDiscountAmount = roundMoney(
    billableLines.reduce((sum, l) => moneyAdd(sum, l.discountAmount), money(0)),
  );

  const linesTotalExcludingTax = roundMoney(
    billableLines.reduce((sum, l) => moneyAdd(sum, l.totalExcludingTax), money(0)),
  );

  const linesVatAmount = roundMoney(
    billableLines.reduce((sum, l) => moneyAdd(sum, l.totalVatAmount), money(0)),
  );

  const globalDiscountAmount = calcDiscount(
    linesTotalExcludingTax,
    input.globalDiscountType,
    input.globalDiscountValue,
  );

  const shipping = roundMoney(moneyClamp(input.shippingAmountExcludingTax, 0, Number.MAX_SAFE_INTEGER));
  const otherFees = roundMoney(moneyClamp(input.otherFeesExcludingTax, 0, Number.MAX_SAFE_INTEGER));
  const feesVat = calculateVatAmount(moneyAdd(shipping, otherFees), defaultVatRate);

  const totalExcludingTax = roundMoney(
    moneyAdd(
      moneySub(linesTotalExcludingTax, globalDiscountAmount),
      moneyAdd(shipping, otherFees),
    ),
  );

  const vatRatio = isZero(linesTotalExcludingTax)
    ? money(0)
    : moneyDiv(linesVatAmount, linesTotalExcludingTax);
  const totalVatAmount = roundMoney(
    moneyAdd(
      moneySub(linesVatAmount, moneyMul(globalDiscountAmount, vatRatio)),
      feesVat,
    ),
  );

  const totalIncludingTax = roundMoney(moneyAdd(totalExcludingTax, totalVatAmount));
  const totalDiscountAmount = roundMoney(moneyAdd(lineDiscountAmount, globalDiscountAmount));

  return {
    subtotalExcludingTax: moneyToNumber(subtotalExcludingTax),
    lineDiscountAmount: moneyToNumber(lineDiscountAmount),
    globalDiscountAmount: moneyToNumber(globalDiscountAmount),
    totalDiscountAmount: moneyToNumber(totalDiscountAmount),
    totalExcludingTax: moneyToNumber(totalExcludingTax),
    totalVatAmount: moneyToNumber(totalVatAmount),
    totalIncludingTax: moneyToNumber(totalIncludingTax),
    lines: calculatedLines,
  };
}
