"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import { InvoiceReminderStatusBadge, ReminderLevelBadge } from "@/components/reminders/reminder-badges";
import { ReminderSendDialog } from "@/components/reminders/reminder-send-dialog";
import { getDaysOverdue, shouldInvoiceBeReminded } from "@/lib/collection-utils";
import { isPositive } from "@/lib/money";
import { REMINDER_NOTE_TYPE_LABELS } from "@/lib/reminder-utils";
import type { SessionUser } from "@/lib/permissions";
import type { InvoicePaymentStatus, InvoiceReminderStatus, InvoiceStatus } from "@prisma/client";
import { formatDateShort } from "@/lib/utils";
import {
  markInvoiceDisputedAction,
  pauseCollectionAction,
  resolveInvoiceDisputeAction,
  resumeCollectionAction,
  setPromisedPaymentDateAction,
  createReminderNoteAction,
} from "@/server/actions/collection.actions";
import Link from "next/link";
import type { MoneyInput } from "@/lib/money";

type Props = {
  user: SessionUser;
  invoice: {
    id: string;
    invoiceNumber: string;
    dueDate: Date;
    amountDue: MoneyInput;
    status: InvoiceStatus;
    paymentStatus: InvoicePaymentStatus;
    isArchived?: boolean;
    isDisputed: boolean;
    isCollectionPaused: boolean;
    disputeReason: string | null;
    collectionPausedReason: string | null;
    promisedPaymentDate: Date | null;
    reminderStatus: InvoiceReminderStatus;
    lastReminderAt: Date | null;
    lastReminderLevel: string | null;
    reminderCount: number;
    customer: { id: string; name: string };
  };
  reminders: {
    id: string;
    reminderNumber: string;
    level: string;
    status: string;
    simulatedSentAt: Date | null;
    subject: string;
  }[];
  notes: {
    id: string;
    type: string;
    content: string;
    createdAt: Date;
    user: { name: string } | null;
  }[];
};

export function InvoiceCollectionSection({ user, invoice, reminders, notes }: Props) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);
  const daysOverdue = getDaysOverdue(invoice.dueDate);
  const eligible = shouldInvoiceBeReminded(invoice);

  async function runAction(action: () => Promise<{ success: boolean; error?: string }>, msg: string) {
    const result = await action();
    if (result.success) {
      toast.success(msg);
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recouvrement</CardTitle>
        {eligible && (
          <PermissionGate user={user} permission="REMINDERS_SEND">
            <Button size="sm" onClick={() => setSendOpen(true)}><Mail className="h-4 w-4" /> Relancer</Button>
          </PermissionGate>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <p>Statut : <InvoiceReminderStatusBadge status={invoice.reminderStatus} /></p>
          <p>Relances : <strong>{invoice.reminderCount}</strong></p>
          <p>Retard : <strong className="text-red-600">{daysOverdue} j</strong></p>
          {invoice.lastReminderAt && (
            <p className="md:col-span-3">Dernière relance : {formatDateShort(invoice.lastReminderAt)}
              {invoice.lastReminderLevel && <> — <ReminderLevelBadge level={invoice.lastReminderLevel as "FRIENDLY"} /></>}
            </p>
          )}
          {invoice.isDisputed && <p className="md:col-span-3 text-destructive">Litige : {invoice.disputeReason}</p>}
          {invoice.isCollectionPaused && <p className="md:col-span-3 text-amber-700">Suspendu : {invoice.collectionPausedReason}</p>}
          {invoice.promisedPaymentDate && <p className="md:col-span-3">Promesse : {formatDateShort(invoice.promisedPaymentDate)}</p>}
        </div>

        {!eligible && isPositive(invoice.amountDue) && daysOverdue > 0 && (
          <p className="text-sm text-[var(--color-muted-foreground)]">Cette facture n{"'"}est pas éligible à la relance (litige, pause ou statut).</p>
        )}

        {reminders.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-sm">Relances liées</p>
            {reminders.map((r) => (
              <Link key={r.id} href={`/reminders/${r.id}`} className="block rounded border p-2 text-sm hover:bg-slate-50">
                <span className="font-mono">{r.reminderNumber}</span> — {r.subject}
              </Link>
            ))}
          </div>
        )}

        <PermissionGate user={user} permission="REMINDERS_UPDATE">
          <div className="flex flex-wrap gap-2">
            {!invoice.isCollectionPaused ? (
              <Button size="sm" variant="outline" onClick={() => {
                const reason = prompt("Raison de la suspension :");
                if (reason && reason.length >= 3) runAction(() => pauseCollectionAction({ invoiceId: invoice.id, reason }), "Recouvrement suspendu");
              }}>Suspendre</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => runAction(() => resumeCollectionAction(invoice.id), "Recouvrement repris")}>Reprendre</Button>
            )}
            {!invoice.isDisputed ? (
              <Button size="sm" variant="outline" onClick={() => {
                const reason = prompt("Raison du litige :");
                if (reason && reason.length >= 3) runAction(() => markInvoiceDisputedAction({ invoiceId: invoice.id, reason }), "Litige enregistré");
              }}>Marquer litige</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => runAction(() => resolveInvoiceDisputeAction(invoice.id), "Litige résolu")}>Résoudre litige</Button>
            )}
          </div>
          <form
            className="grid gap-2 md:grid-cols-3 pt-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const date = String(fd.get("promisedDate"));
              if (!date) return;
              await runAction(
                () => setPromisedPaymentDateAction({ invoiceId: invoice.id, promisedPaymentDate: new Date(date), note: String(fd.get("note") || "") }),
                "Promesse enregistrée",
              );
            }}
          >
            <div className="space-y-1"><Label>Promesse de paiement</Label><Input name="promisedDate" type="date" /></div>
            <div className="space-y-1 md:col-span-2"><Label>Note</Label><Input name="note" placeholder="Note optionnelle" /></div>
            <Button type="submit" size="sm" variant="outline">Enregistrer promesse</Button>
          </form>
        </PermissionGate>

        {notes.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="font-medium text-sm">Notes de recouvrement</p>
            {notes.map((n) => (
              <div key={n.id} className="rounded border p-2 text-sm">
                <Badge variant="outline">{REMINDER_NOTE_TYPE_LABELS[n.type] ?? n.type}</Badge>
                <p className="mt-1">{n.content}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{formatDateShort(n.createdAt)}</p>
              </div>
            ))}
          </div>
        )}

        <PermissionGate user={user} permission="REMINDERS_CREATE">
          <form
            className="space-y-2 border-t pt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const content = new FormData(e.currentTarget).get("content");
              if (!content) return;
              await runAction(
                () => createReminderNoteAction({ customerId: invoice.customer.id, invoiceId: invoice.id, type: "INTERNAL", content: String(content) }),
                "Note ajoutée",
              );
              e.currentTarget.reset();
            }}
          >
            <Label>Ajouter une note</Label>
            <Textarea name="content" rows={2} required />
            <Button type="submit" size="sm">Ajouter</Button>
          </form>
        </PermissionGate>
      </CardContent>

      <ReminderSendDialog invoiceId={invoice.id} open={sendOpen} onOpenChange={setSendOpen} onSuccess={() => router.refresh()} />
    </Card>
  );
}
