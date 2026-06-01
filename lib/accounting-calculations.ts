import {
  isZero,
  money,
  moneyAdd,
  moneyEq,
  moneyToNumber,
  roundMoney,
  type MoneyInput,
} from "@/lib/money";

export type AccountingEntryLineInput = {
  accountId: string;
  lineNumber: number;
  label: string;
  debit: MoneyInput;
  credit: MoneyInput;
  currency?: string;
  customerId?: string | null;
  supplierId?: string | null;
  invoiceId?: string | null;
  supplierInvoiceId?: string | null;
  paymentId?: string | null;
  taxRate?: MoneyInput | null;
};

export type AccountingEntryTotals = {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  lines: (AccountingEntryLineInput & { debit: number; credit: number })[];
};

export function normalizeEntryLine(line: AccountingEntryLineInput): AccountingEntryLineInput & {
  debit: number;
  credit: number;
} {
  const debit = roundMoney(money(line.debit).isNegative() ? 0 : line.debit);
  const credit = roundMoney(money(line.credit).isNegative() ? 0 : line.credit);
  if (debit.greaterThan(0) && credit.greaterThan(0)) {
    throw new Error("Une ligne ne peut pas avoir débit et crédit simultanément");
  }
  return {
    ...line,
    debit: moneyToNumber(debit),
    credit: moneyToNumber(credit),
    currency: line.currency ?? "EUR",
  };
}

export function calculateAccountingEntryTotals(
  lines: AccountingEntryLineInput[],
): AccountingEntryTotals {
  const normalized = lines.map(normalizeEntryLine);
  const totalDebit = roundMoney(
    normalized.reduce((s, l) => moneyAdd(s, l.debit), money(0)),
  );
  const totalCredit = roundMoney(
    normalized.reduce((s, l) => moneyAdd(s, l.credit), money(0)),
  );
  const isBalanced = moneyEq(totalDebit, totalCredit) && !isZero(totalDebit);
  return {
    totalDebit: moneyToNumber(totalDebit),
    totalCredit: moneyToNumber(totalCredit),
    isBalanced,
    lines: normalized,
  };
}

export function getEntryPeriod(entryDate: Date): { periodYear: number; periodMonth: number } {
  return { periodYear: entryDate.getFullYear(), periodMonth: entryDate.getMonth() + 1 };
}

export function canValidateEntryTotals(totals: AccountingEntryTotals, minLines = 2): boolean {
  if (totals.lines.length < minLines) return false;
  if (totals.lines.some((l) => l.debit < 0 || l.credit < 0)) return false;
  if (totals.lines.some((l) => l.debit > 0 && l.credit > 0)) return false;
  if (totals.lines.every((l) => l.debit === 0 && l.credit === 0)) return false;
  return totals.isBalanced;
}
