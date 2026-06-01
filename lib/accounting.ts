import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccountingEntryFilterInput } from "@/lib/accounting-validators";
import { buildDateRangeFilter } from "@/lib/accounting-utils";
import { moneySub, moneyToNumber } from "@/lib/money";

const entryInclude = {
  journal: true,
  createdBy: { select: { id: true, name: true, email: true } },
  validatedBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: { account: true },
    orderBy: { lineNumber: "asc" as const },
  },
} satisfies Prisma.AccountingEntryInclude;

export async function listAccountingAccountsQuery(
  organizationId: string,
  filters?: { q?: string; type?: string; category?: string; active?: string },
) {
  const where: Prisma.AccountingAccountWhereInput = { organizationId };
  if (filters?.q) {
    where.OR = [
      { accountNumber: { contains: filters.q } },
      { name: { contains: filters.q } },
    ];
  }
  if (filters?.type) where.type = filters.type as never;
  if (filters?.category) where.category = filters.category as never;
  if (filters?.active === "true") where.isActive = true;
  if (filters?.active === "false") where.isActive = false;

  return prisma.accountingAccount.findMany({
    where,
    orderBy: [{ accountNumber: "asc" }],
  });
}

export async function listAccountingJournalsQuery(organizationId: string) {
  return prisma.accountingJournal.findMany({
    where: { organizationId },
    orderBy: [{ code: "asc" }],
    include: { _count: { select: { entries: true } } },
  });
}

function buildEntryWhere(
  organizationId: string,
  filters: AccountingEntryFilterInput,
): Prisma.AccountingEntryWhereInput {
  const where: Prisma.AccountingEntryWhereInput = { organizationId };
  if (filters.q) {
    where.OR = [
      { entryNumber: { contains: filters.q } },
      { label: { contains: filters.q } },
      { sourceLabel: { contains: filters.q } },
      { reference: { contains: filters.q } },
    ];
  }
  if (filters.status && filters.status !== "all") where.status = filters.status as never;
  if (filters.journalId && filters.journalId !== "all") where.journalId = filters.journalId;
  if (filters.sourceType && filters.sourceType !== "all") where.sourceType = filters.sourceType as never;
  const dateRange = buildDateRangeFilter(filters.dateFrom, filters.dateTo);
  if (dateRange) where.entryDate = dateRange;
  if (filters.balanced === "true") where.isBalanced = true;
  if (filters.balanced === "false") where.isBalanced = false;
  return where;
}

export async function listAccountingEntriesQuery(
  organizationId: string,
  filters: AccountingEntryFilterInput,
) {
  const where = buildEntryWhere(organizationId, filters);
  const skip = (filters.page - 1) * filters.pageSize;
  const orderBy = { [filters.sortBy]: filters.sortOrder } as Prisma.AccountingEntryOrderByWithRelationInput;

  const [entries, total] = await Promise.all([
    prisma.accountingEntry.findMany({
      where,
      include: { journal: true },
      orderBy,
      skip,
      take: filters.pageSize,
    }),
    prisma.accountingEntry.count({ where }),
  ]);

  return { entries, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getAccountingEntryByIdQuery(organizationId: string, id: string) {
  return prisma.accountingEntry.findFirst({
    where: { id, organizationId },
    include: entryInclude,
  });
}

export async function getAccountingEntryBySourceQuery(
  organizationId: string,
  sourceType: string,
  sourceId: string,
) {
  return prisma.accountingEntry.findFirst({
    where: { organizationId, sourceType: sourceType as never, sourceId },
    include: { journal: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAccountingEntriesForExportQuery(
  organizationId: string,
  filters: AccountingEntryFilterInput,
) {
  return prisma.accountingEntry.findMany({
    where: buildEntryWhere(organizationId, filters),
    include: { journal: true, lines: { include: { account: true } } },
    orderBy: { entryDate: "desc" },
  });
}

export async function getAccountingDashboardStatsQuery(organizationId: string) {
  const [total, drafts, validated, cancelled, aggregates, vatCollected, vatDeductible] =
    await Promise.all([
      prisma.accountingEntry.count({ where: { organizationId } }),
      prisma.accountingEntry.count({ where: { organizationId, status: "DRAFT" } }),
      prisma.accountingEntry.count({ where: { organizationId, status: "VALIDATED" } }),
      prisma.accountingEntry.count({ where: { organizationId, status: "CANCELLED" } }),
      prisma.accountingEntry.aggregate({
        where: { organizationId, status: { not: "CANCELLED" } },
        _sum: { totalDebit: true, totalCredit: true },
      }),
      prisma.accountingEntryLine.aggregate({
        where: {
          organizationId,
          credit: { gt: 0 },
          account: { accountNumber: "445710" },
          entry: { status: "VALIDATED" },
        },
        _sum: { credit: true },
      }),
      prisma.accountingEntryLine.aggregate({
        where: {
          organizationId,
          debit: { gt: 0 },
          account: { accountNumber: "445660" },
          entry: { status: "VALIDATED" },
        },
        _sum: { debit: true },
      }),
    ]);

  const totalDebit = aggregates._sum.totalDebit ?? 0;
  const totalCredit = aggregates._sum.totalCredit ?? 0;

  return {
    total,
    drafts,
    validated,
    cancelled,
    totalDebit,
    totalCredit,
    gap: Math.abs(moneyToNumber(moneySub(totalDebit, totalCredit))),
    vatCollected: moneyToNumber(vatCollected._sum.credit ?? 0),
    vatDeductible: moneyToNumber(vatDeductible._sum.debit ?? 0),
  };
}

export async function getAccountingFormDataQuery(organizationId: string) {
  const [accounts, journals] = await Promise.all([
    listAccountingAccountsQuery(organizationId, { active: "true" }),
    prisma.accountingJournal.findMany({
      where: { organizationId, isActive: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return { accounts, journals };
}

export async function getJournalByCodeQuery(organizationId: string, code: string) {
  return prisma.accountingJournal.findFirst({ where: { organizationId, code } });
}

export async function getAccountByNumberQuery(organizationId: string, accountNumber: string) {
  return prisma.accountingAccount.findFirst({ where: { organizationId, accountNumber } });
}
