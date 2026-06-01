import type {
  InvoicePaymentStatus,
  InvoiceReminderStatus,
  InvoiceStatus,
  ReminderLevel,
} from "@prisma/client";
import { isPositive, isZero, type MoneyInput } from "@/lib/money";

export type InvoiceForCollection = {
  status: InvoiceStatus;
  paymentStatus: InvoicePaymentStatus;
  amountDue: MoneyInput;
  dueDate: Date;
  isArchived?: boolean;
  isCollectionPaused?: boolean;
  isDisputed?: boolean;
  reminderStatus?: InvoiceReminderStatus;
};

export function getDaysOverdue(dueDate: Date, now: Date = new Date()): number {
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  if (now <= end) return 0;
  const diff = now.getTime() - end.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getRecommendedReminderLevel(daysOverdue: number): ReminderLevel {
  if (daysOverdue <= 0) return "FRIENDLY";
  if (daysOverdue <= 7) return "FRIENDLY";
  if (daysOverdue <= 30) return "FIRST_NOTICE";
  if (daysOverdue <= 60) return "SECOND_NOTICE";
  return "FINAL_NOTICE";
}

export function shouldInvoiceBeReminded(
  invoice: InvoiceForCollection,
  now: Date = new Date(),
  options?: { includePaused?: boolean; includeDisputed?: boolean },
): boolean {
  if (invoice.isArchived) return false;
  if (["DRAFT", "PAID", "CANCELLED", "CREDITED"].includes(invoice.status)) return false;
  if (!isPositive(invoice.amountDue)) return false;
  if (getDaysOverdue(invoice.dueDate, now) <= 0) return false;
  if (invoice.isCollectionPaused && !options?.includePaused) return false;
  if (invoice.isDisputed && !options?.includeDisputed) return false;
  return ["VALIDATED", "SENT", "OVERDUE", "PARTIALLY_PAID"].includes(invoice.status);
}

export function getInvoiceCollectionStatus(
  invoice: InvoiceForCollection & { reminderCount?: number },
  now: Date = new Date(),
): InvoiceReminderStatus {
  if (invoice.isDisputed) return "DISPUTED";
  if (invoice.isCollectionPaused) return "PAUSED";
  if (isZero(invoice.amountDue)) return "NONE";
  if (shouldInvoiceBeReminded(invoice, now)) {
    return (invoice.reminderCount ?? 0) > 0 ? "REMINDED" : "TO_REMIND";
  }
  return invoice.reminderStatus ?? "NONE";
}
