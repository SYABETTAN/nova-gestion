import {
  money,
  moneyAdd,
  moneyClamp,
  moneyMin,
  moneySub,
  moneyToNumber,
  roundMoney,
  type MoneyInput,
} from "@/lib/money";

export type SupplierInvoiceLineInput = {
  quantity: MoneyInput;
  unitPriceExcludingTax: MoneyInput;
  discountAmount: MoneyInput;
  vatRate: MoneyInput;
};

export type CalculatedSupplierInvoiceLine = SupplierInvoiceLineInput & {
  lineSubtotalExcludingTax: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
};

export type SupplierInvoiceTotals = {
  subtotalExcludingTax: number;
  totalDiscountAmount: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  amountPaid: number;
  amountDue: number;
  lines: CalculatedSupplierInvoiceLine[];
};

function lineToNumbers(
  line: SupplierInvoiceLineInput,
  amounts: {
    discountAmount: ReturnType<typeof roundMoney>;
    lineSubtotalExcludingTax: ReturnType<typeof roundMoney>;
    totalExcludingTax: ReturnType<typeof roundMoney>;
    totalVatAmount: ReturnType<typeof roundMoney>;
    totalIncludingTax: ReturnType<typeof roundMoney>;
  },
): CalculatedSupplierInvoiceLine {
  return {
    ...line,
    discountAmount: moneyToNumber(amounts.discountAmount),
    lineSubtotalExcludingTax: moneyToNumber(amounts.lineSubtotalExcludingTax),
    totalExcludingTax: moneyToNumber(amounts.totalExcludingTax),
    totalVatAmount: moneyToNumber(amounts.totalVatAmount),
    totalIncludingTax: moneyToNumber(amounts.totalIncludingTax),
  };
}

export function calculateSupplierInvoiceLineTotals(
  line: SupplierInvoiceLineInput,
): CalculatedSupplierInvoiceLine {
  const lineSubtotalExcludingTax = roundMoney(money(line.quantity).times(money(line.unitPriceExcludingTax)));
  const discountAmount = roundMoney(
    moneyMin(moneyClamp(line.discountAmount, 0, Number.MAX_SAFE_INTEGER), lineSubtotalExcludingTax),
  );
  const totalExcludingTax = roundMoney(moneySub(lineSubtotalExcludingTax, discountAmount));
  const totalVatAmount = roundMoney(
    totalExcludingTax.times(money(line.vatRate).dividedBy(100)),
  );
  const totalIncludingTax = roundMoney(moneyAdd(totalExcludingTax, totalVatAmount));

  return lineToNumbers(line, {
    discountAmount,
    lineSubtotalExcludingTax,
    totalExcludingTax,
    totalVatAmount,
    totalIncludingTax,
  });
}

export function calculateSupplierInvoiceTotals(
  lines: SupplierInvoiceLineInput[],
  amountPaid: MoneyInput = 0,
): SupplierInvoiceTotals {
  const calculatedLines = lines.map(calculateSupplierInvoiceLineTotals);
  const subtotalExcludingTax = roundMoney(
    calculatedLines.reduce((sum, l) => moneyAdd(sum, l.lineSubtotalExcludingTax), money(0)),
  );
  const totalDiscountAmount = roundMoney(
    calculatedLines.reduce((sum, l) => moneyAdd(sum, l.discountAmount), money(0)),
  );
  const totalExcludingTax = roundMoney(
    calculatedLines.reduce((sum, l) => moneyAdd(sum, l.totalExcludingTax), money(0)),
  );
  const totalVatAmount = roundMoney(
    calculatedLines.reduce((sum, l) => moneyAdd(sum, l.totalVatAmount), money(0)),
  );
  const totalIncludingTax = roundMoney(
    calculatedLines.reduce((sum, l) => moneyAdd(sum, l.totalIncludingTax), money(0)),
  );
  const paid = roundMoney(moneyClamp(amountPaid, 0, totalIncludingTax));
  const amountDue = roundMoney(moneySub(totalIncludingTax, paid));

  return {
    subtotalExcludingTax: moneyToNumber(subtotalExcludingTax),
    totalDiscountAmount: moneyToNumber(totalDiscountAmount),
    totalExcludingTax: moneyToNumber(totalExcludingTax),
    totalVatAmount: moneyToNumber(totalVatAmount),
    totalIncludingTax: moneyToNumber(totalIncludingTax),
    amountPaid: moneyToNumber(paid),
    amountDue: moneyToNumber(moneyClamp(amountDue, 0, Number.MAX_SAFE_INTEGER)),
    lines: calculatedLines,
  };
}

export function groupSupplierInvoiceVatByRate(
  lines: CalculatedSupplierInvoiceLine[],
): { rate: number; base: number; vat: number }[] {
  const map = new Map<string, { base: ReturnType<typeof roundMoney>; vat: ReturnType<typeof roundMoney> }>();
  for (const line of lines) {
    const key = money(line.vatRate).toFixed(4);
    const existing = map.get(key) ?? { base: money(0), vat: money(0) };
    existing.base = roundMoney(moneyAdd(existing.base, line.totalExcludingTax));
    existing.vat = roundMoney(moneyAdd(existing.vat, line.totalVatAmount));
    map.set(key, existing);
  }
  return [...map.entries()]
    .map(([rateKey, v]) => ({
      rate: moneyToNumber(rateKey),
      base: moneyToNumber(v.base),
      vat: moneyToNumber(v.vat),
    }))
    .sort((a, b) => a.rate - b.rate);
}
