import type { DiscountType, InvoiceLineType } from "@prisma/client";
import {
  calculateVatAmount,
  money,
  moneyAdd,
  moneyClamp,
  moneyMul,
  moneySub,
  moneyToNumber,
  roundMoney,
  type MoneyInput,
} from "@/lib/money";
import {
  calculateDiscountAmount,
  calculateQuoteLineTotals,
  calculateQuoteTotals,
  groupVatByRate,
  isBillableLineType,
} from "@/lib/quote-calculations";

export type InvoiceLineCalculationInput = {
  lineType: InvoiceLineType;
  quantity: MoneyInput;
  unitPriceExcludingTax: MoneyInput;
  discountType?: DiscountType | null;
  discountValue: MoneyInput;
  vatRate: MoneyInput;
};

export type CalculatedInvoiceLine = InvoiceLineCalculationInput & {
  discountAmount: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
};

export type InvoiceTotalsInput = {
  lines: InvoiceLineCalculationInput[];
  globalDiscountType?: DiscountType | null;
  globalDiscountValue: MoneyInput;
  shippingAmountExcludingTax: MoneyInput;
  otherFeesExcludingTax: MoneyInput;
  amountPaid?: MoneyInput;
  defaultVatRate?: MoneyInput;
};

export type CalculatedInvoiceTotals = {
  subtotalExcludingTax: number;
  lineDiscountAmount: number;
  globalDiscountAmount: number;
  totalDiscountAmount: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  amountPaid: number;
  amountDue: number;
  lines: CalculatedInvoiceLine[];
};

export {
  calculateDiscountAmount,
  groupVatByRate,
  isBillableLineType,
};

export function calculateInvoiceLineTotals(
  line: InvoiceLineCalculationInput,
): CalculatedInvoiceLine {
  return calculateQuoteLineTotals({
    ...line,
    lineType: line.lineType as Parameters<typeof calculateQuoteLineTotals>[0]["lineType"],
  }) as CalculatedInvoiceLine;
}

export function calculateInvoiceTotals(input: InvoiceTotalsInput): CalculatedInvoiceTotals {
  const quoteTotals = calculateQuoteTotals({
    lines: input.lines.map((l) => ({
      ...l,
      lineType: l.lineType as Parameters<typeof calculateQuoteTotals>[0]["lines"][0]["lineType"],
    })),
    globalDiscountType: input.globalDiscountType,
    globalDiscountValue: input.globalDiscountValue,
    shippingAmountExcludingTax: input.shippingAmountExcludingTax,
    otherFeesExcludingTax: input.otherFeesExcludingTax,
    defaultVatRate: input.defaultVatRate,
  });

  const amountPaid = roundMoney(moneyClamp(input.amountPaid ?? 0, 0, Number.MAX_SAFE_INTEGER));
  const amountDue = roundMoney(
    moneySub(quoteTotals.totalIncludingTax, amountPaid),
  );

  return {
    ...quoteTotals,
    amountPaid: moneyToNumber(amountPaid),
    amountDue: moneyToNumber(moneyClamp(amountDue, 0, Number.MAX_SAFE_INTEGER)),
    lines: quoteTotals.lines as CalculatedInvoiceLine[],
  };
}

export function calculateCreditNoteLineTotals(input: {
  quantity: MoneyInput;
  unitPriceExcludingTax: MoneyInput;
  vatRate: MoneyInput;
}) {
  const totalExcludingTax = roundMoney(moneyMul(input.quantity, input.unitPriceExcludingTax));
  const totalVatAmount = calculateVatAmount(totalExcludingTax, input.vatRate);
  const totalIncludingTax = roundMoney(moneyAdd(totalExcludingTax, totalVatAmount));
  return {
    totalExcludingTax: moneyToNumber(totalExcludingTax),
    totalVatAmount: moneyToNumber(totalVatAmount),
    totalIncludingTax: moneyToNumber(totalIncludingTax),
  };
}
