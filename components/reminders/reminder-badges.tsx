import type { InvoiceReminderStatus, ReminderLevel, ReminderStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  getReminderLevelColor,
  getReminderLevelLabel,
  INVOICE_REMINDER_STATUS_LABELS,
  REMINDER_STATUS_LABELS,
} from "@/lib/reminder-utils";

export function ReminderLevelBadge({ level }: { level: ReminderLevel }) {
  return (
    <Badge variant="outline" className={getReminderLevelColor(level)}>
      {getReminderLevelLabel(level)}
    </Badge>
  );
}

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  const variant =
    status === "SIMULATED_SENT" ? "success" : status === "CANCELLED" ? "destructive" : "secondary";
  return <Badge variant={variant}>{REMINDER_STATUS_LABELS[status] ?? status}</Badge>;
}

export function InvoiceReminderStatusBadge({ status }: { status: InvoiceReminderStatus }) {
  const variant =
    status === "DISPUTED"
      ? "destructive"
      : status === "PAUSED"
        ? "warning"
        : status === "REMINDED"
          ? "default"
          : "secondary";
  return <Badge variant={variant}>{INVOICE_REMINDER_STATUS_LABELS[status] ?? status}</Badge>;
}
