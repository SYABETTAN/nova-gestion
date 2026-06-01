"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import type { ReminderLevel, ReminderStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ReminderLevelBadge, ReminderStatusBadge } from "@/components/reminders/reminder-badges";
import { formatCurrency } from "@/lib/pricing";
import { getReminderSentDate } from "@/lib/reminder-utils";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import { exportReminderHistoryCsvAction } from "@/server/actions/reminder.actions";

type ReminderRow = {
  id: string;
  reminderNumber: string;
  level: ReminderLevel;
  status: ReminderStatus;
  recipientEmail: string;
  subject: string;
  daysOverdue: number;
  invoiceAmountDue: MoneyInput;
  sentAt: Date | null;
  simulatedSentAt: Date | null;
  createdAt: Date;
  customer: { id: string; name: string };
  invoice: { invoiceNumber: string };
};

export function ReminderHistoryPageClient({
  user,
  reminders,
  total,
  page,
  totalPages,
}: {
  user: SessionUser;
  reminders: ReminderRow[];
  total: number;
  page: number;
  totalPages: number;
}) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    const result = await exportReminderHistoryCsvAction();
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "historique-relances.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Historique des relances</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">Consultez l&apos;historique des relances envoyées.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/reminders">← Retour</Link></Button>
          <PermissionGate user={user} permission="REMINDERS_EXPORT">
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />{exporting ? "Export..." : "Exporter historique"}
            </Button>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {reminders.length === 0 ? (
            <p className="p-8 text-center text-[var(--color-muted-foreground)]">Aucune relance enregistrée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° relance</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Destinataire</TableHead>
                  <TableHead className="text-right">Montant dû</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminders.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.reminderNumber}</TableCell>
                    <TableCell>{formatDateShort(getReminderSentDate(r) ?? r.createdAt)}</TableCell>
                    <TableCell>{r.customer.name}</TableCell>
                    <TableCell className="font-mono">{r.invoice.invoiceNumber}</TableCell>
                    <TableCell><ReminderLevelBadge level={r.level} /></TableCell>
                    <TableCell><ReminderStatusBadge status={r.status} /></TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.recipientEmail}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.invoiceAmountDue)}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" asChild><Link href={`/reminders/${r.id}`}>Voir</Link></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">Page {page} / {totalPages} — {total} relance(s)</p>
      )}
    </div>
  );
}
