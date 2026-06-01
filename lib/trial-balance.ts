import { prisma } from "@/lib/prisma";
import type { TrialBalanceFilterInput } from "@/lib/accounting-validators";
import { buildDateRangeFilter } from "@/lib/accounting-utils";
import {
  isZero,
  money,
  moneyAdd,
  moneySub,
  moneyToNumber,
  roundMoney,
  type MoneyInput,
} from "@/lib/money";
import { roundMoney as roundMoneyNumber } from "@/lib/pricing";

export type TrialBalanceRow = {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
};

export async function getTrialBalanceQuery(
  organizationId: string,
  filters: TrialBalanceFilterInput,
) {
  const dateRange = buildDateRangeFilter(filters.dateFrom, filters.dateTo);
  const statusFilter =
    filters.includeDrafts === "true" ? undefined : { in: ["VALIDATED"] as ("VALIDATED")[] };

  const accounts = await prisma.accountingAccount.findMany({
    where: {
      organizationId,
      ...(filters.activeOnly !== "false" ? { isActive: true } : {}),
      ...(filters.accountType ? { type: filters.accountType as never } : {}),
    },
    orderBy: { accountNumber: "asc" },
  });

  const rows: TrialBalanceRow[] = [];

  for (const account of accounts) {
    const agg = await prisma.accountingEntryLine.aggregate({
      where: {
        organizationId,
        accountId: account.id,
        ...(dateRange ? { entry: { entryDate: dateRange } } : {}),
        ...(statusFilter ? { entry: { status: statusFilter } } : {}),
      },
      _sum: { debit: true, credit: true },
    });

    const mapped = mapTrialBalanceRow({
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.name,
      accountType: account.type,
      totalDebit: agg._sum.debit ?? 0,
      totalCredit: agg._sum.credit ?? 0,
    });
    if (mapped) rows.push(mapped);
  }

  return rows;
}

export function mapTrialBalanceRow(params: {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  totalDebit: MoneyInput;
  totalCredit: MoneyInput;
}): TrialBalanceRow | null {
  const totalDebit = roundMoney(params.totalDebit);
  const totalCredit = roundMoney(params.totalCredit);
  if (isZero(totalDebit) && isZero(totalCredit)) return null;

  const net = roundMoney(moneySub(totalDebit, totalCredit));
  return {
    accountId: params.accountId,
    accountNumber: params.accountNumber,
    accountName: params.accountName,
    accountType: params.accountType,
    totalDebit: moneyToNumber(totalDebit),
    totalCredit: moneyToNumber(totalCredit),
    debitBalance: net.greaterThan(0) ? moneyToNumber(net) : 0,
    creditBalance: net.lessThan(0) ? moneyToNumber(net.abs()) : 0,
  };
}

export function computeTrialBalanceTotals(rows: TrialBalanceRow[]) {
  return {
    totalDebit: roundMoneyNumber(rows.reduce((s, r) => moneyAdd(s, r.totalDebit), money(0))),
    totalCredit: roundMoneyNumber(rows.reduce((s, r) => moneyAdd(s, r.totalCredit), money(0))),
    totalDebitBalance: roundMoneyNumber(rows.reduce((s, r) => moneyAdd(s, r.debitBalance), money(0))),
    totalCreditBalance: roundMoneyNumber(rows.reduce((s, r) => moneyAdd(s, r.creditBalance), money(0))),
  };
}
