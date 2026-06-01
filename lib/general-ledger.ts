import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/pricing";
import { money, moneyAdd, moneySub, moneyToNumber } from "@/lib/money";
import type { GeneralLedgerFilterInput } from "@/lib/accounting-validators";
import { buildDateRangeFilter } from "@/lib/accounting-utils";

export type GeneralLedgerRow = {
  id: string;
  entryDate: Date;
  journalCode: string;
  entryNumber: string;
  label: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export async function getGeneralLedgerQuery(
  organizationId: string,
  filters: GeneralLedgerFilterInput,
) {
  const dateRange = buildDateRangeFilter(filters.dateFrom, filters.dateTo);
  const statusFilter =
    filters.includeDrafts === "true" ? undefined : { in: ["VALIDATED"] as ("VALIDATED")[] };

  const lines = await prisma.accountingEntryLine.findMany({
    where: {
      organizationId,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.journalId ? { entry: { journalId: filters.journalId } } : {}),
      ...(filters.sourceType ? { entry: { sourceType: filters.sourceType as never } } : {}),
      ...(dateRange ? { entry: { entryDate: dateRange } } : {}),
      ...(statusFilter ? { entry: { status: statusFilter } } : {}),
    },
    include: {
      account: true,
      entry: { include: { journal: true } },
    },
    orderBy: [{ entry: { entryDate: "asc" } }, { entry: { entryNumber: "asc" } }, { lineNumber: "asc" }],
  });

  let runningBalance = money(0);
  const rows: GeneralLedgerRow[] = lines.map((line) => {
    runningBalance = money(moneyAdd(moneySub(runningBalance, line.credit), line.debit));
    return {
      id: line.id,
      entryDate: line.entry.entryDate,
      journalCode: line.entry.journal.code,
      entryNumber: line.entry.entryNumber,
      label: line.label,
      accountNumber: line.account.accountNumber,
      accountName: line.account.name,
      debit: moneyToNumber(line.debit),
      credit: moneyToNumber(line.credit),
      runningBalance: moneyToNumber(runningBalance),
    };
  });

  return rows;
}
