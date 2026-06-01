import type { AccountingEntryStatus } from "@prisma/client";

export function isAccountingEntryEditable(status: AccountingEntryStatus): boolean {
  return status === "DRAFT";
}

export function canValidateAccountingEntry(status: AccountingEntryStatus): boolean {
  return status === "DRAFT";
}

export function canCancelAccountingEntry(status: AccountingEntryStatus): boolean {
  return status !== "CANCELLED";
}

export function buildDateRangeFilter(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (dateFrom) range.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return range;
}
