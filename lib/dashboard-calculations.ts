import { money, moneyAdd, moneyToNumber, type MoneyInput } from "@/lib/money";
import { roundMoney } from "@/lib/pricing";
import type { DateRange, OverdueBucket } from "@/lib/dashboard-types";
import { isDateInRange } from "@/lib/dashboard-periods";

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

export function computePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return roundMoney(money(current).minus(previous).dividedBy(previous).times(100));
}

export function sumBy<T>(items: T[], getter: (item: T) => MoneyInput): number {
  return roundMoney(items.reduce((s, i) => moneyAdd(s, getter(i)), money(0)));
}

export function groupByMonth<T extends { date: Date; amount: MoneyInput }>(
  records: T[],
  range: DateRange,
): { month: string; label: string; value: number }[] {
  const map = new Map<string, ReturnType<typeof money>>();

  const cursor = new Date(range.startDate.getFullYear(), range.startDate.getMonth(), 1);
  const end = new Date(range.endDate.getFullYear(), range.endDate.getMonth(), 1);

  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, money(0));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const r of records) {
    if (!isDateInRange(r.date, range.startDate, range.endDate)) continue;
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, moneyAdd(map.get(key) ?? 0, r.amount));
  }

  return [...map.entries()].map(([month, value]) => {
    const [y, m] = month.split("-");
    const label = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(
      new Date(Number(y), Number(m) - 1, 1),
    );
    return { month, label, value: moneyToNumber(value) };
  });
}

export function groupByStatus<T>(
  items: T[],
  statusField: keyof T,
  labels: Record<string, string>,
): { name: string; value: number; key: string }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = String(item[statusField]);
    map.set(key, roundMoney(moneyAdd(map.get(key) ?? 0, 1)));
  }
  return [...map.entries()].map(([key, value]) => ({
    key,
    name: labels[key] ?? key,
    value,
  }));
}

export function groupByStatusAmount<T>(
  items: T[],
  statusField: keyof T,
  amountField: keyof T,
  labels: Record<string, string>,
): { name: string; value: number; key: string }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = String(item[statusField]);
    map.set(key, roundMoney(moneyAdd(map.get(key) ?? 0, item[amountField] as MoneyInput)));
  }
  return [...map.entries()].map(([key, value]) => ({
    key,
    name: labels[key] ?? key,
    value,
  }));
}

export function getTopByAmount<T extends { id: string; name: string; amount: number }>(
  rows: T[],
  limit = 5,
): T[] {
  return [...rows].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

export function getOverdueBucket(daysOverdue: number): string {
  if (daysOverdue <= 7) return "1-7";
  if (daysOverdue <= 30) return "8-30";
  if (daysOverdue <= 60) return "31-60";
  return "60+";
}

export function computeOverdueBuckets(
  invoices: { daysOverdue: number; amountDue: MoneyInput }[],
): OverdueBucket[] {
  const labels: Record<string, string> = {
    "1-7": "1 à 7 jours",
    "8-30": "8 à 30 jours",
    "31-60": "31 à 60 jours",
    "60+": "+60 jours",
  };
  const order = ["1-7", "8-30", "31-60", "60+"];
  const map = new Map<string, { amount: number; count: number }>();
  for (const key of order) map.set(key, { amount: 0, count: 0 });

  for (const inv of invoices) {
    const bucket = getOverdueBucket(inv.daysOverdue);
    const existing = map.get(bucket)!;
    existing.amount = roundMoney(moneyAdd(existing.amount, inv.amountDue));
    existing.count += 1;
  }

  return order.map((bucket) => ({
    bucket,
    label: labels[bucket] ?? bucket,
    amount: map.get(bucket)!.amount,
    count: map.get(bucket)!.count,
  }));
}

export function isInvoiceBillable(status: string): boolean {
  return status !== "DRAFT" && status !== "CANCELLED" && status !== "CREDITED";
}

export function isInvoiceOverdue(
  dueDate: Date,
  amountDue: MoneyInput,
  status: string,
  now = new Date(),
): boolean {
  if (!isInvoiceBillable(status) || moneyToNumber(amountDue) <= 0) return false;
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  return now > end;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}
