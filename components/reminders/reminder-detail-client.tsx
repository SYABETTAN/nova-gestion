"use client";

import Link from "next/link";
import type { ReminderLevel, ReminderStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReminderLevelBadge, ReminderStatusBadge } from "@/components/reminders/reminder-badges";
import { REMINDER_ACTIVITY_TYPE_LABELS, getReminderSentDate } from "@/lib/reminder-utils";
import { formatCurrency } from "@/lib/pricing";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";

type ReminderDetail = {
  id: string;
  reminderNumber: string;
  level: ReminderLevel;
  status: ReminderStatus;
  recipientEmail: string;
  subject: string;
  message: string;
  daysOverdue: number;
  invoiceAmountDue: MoneyInput;
  sentAt: Date | null;
  simulatedSentAt: Date | null;
  internalNotes: string | null;
  customer: { id: string; name: string; email: string | null };
  invoice: { id: string; invoiceNumber: string; currency: string };
  createdBy: { name: string } | null;
  activities: { id: string; type: string; title: string; description: string | null; createdAt: Date; user: { name: string } | null }[];
};

export function ReminderDetailClient({ reminder }: { reminder: ReminderDetail }) {
  const sentDate = getReminderSentDate(reminder);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold font-mono">{reminder.reminderNumber}</h1>
            <ReminderLevelBadge level={reminder.level} />
            <ReminderStatusBadge status={reminder.status} />
          </div>
          <p className="mt-1 text-[var(--color-muted-foreground)]">
            {reminder.customer.name} — Facture {reminder.invoice.invoiceNumber}
          </p>
        </div>
        <Button variant="outline" asChild><Link href="/reminders/history">← Historique</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Montant dû</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(reminder.invoiceAmountDue, reminder.invoice.currency)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Jours de retard</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-red-600">{reminder.daysOverdue} j</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Date d&apos;envoi</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{sentDate ? formatDateShort(sentDate) : "—"}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Message</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm"><strong>Destinataire :</strong> {reminder.recipientEmail}</p>
          <p className="text-sm"><strong>Objet :</strong> {reminder.subject}</p>
          <pre className="whitespace-pre-wrap rounded bg-slate-50 p-4 text-sm">{reminder.message}</pre>
          {reminder.internalNotes && <p className="text-sm text-[var(--color-muted-foreground)]"><strong>Notes internes :</strong> {reminder.internalNotes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {reminder.activities.map((a) => (
            <div key={a.id} className="border-l-2 border-violet-200 pl-4">
              <p className="font-medium">{a.title}</p>
              {a.description && <p className="text-sm text-[var(--color-muted-foreground)]">{a.description}</p>}
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {REMINDER_ACTIVITY_TYPE_LABELS[a.type] ?? a.type} — {formatDateShort(a.createdAt)}
                {a.user ? ` — ${a.user.name}` : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
