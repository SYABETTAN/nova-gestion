"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Edit, Mail, Printer, X } from "lucide-react";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import { AccountingSourceSection } from "@/components/accounting/accounting-entry-detail-client";
import { PaymentMethodBadge, PaymentStatusBadge } from "@/components/payments/payment-badges";
import { InvoicePaymentStatusBadge } from "@/components/invoices/invoice-badges";
import { PAYMENT_ACTIVITY_TYPE_LABELS } from "@/lib/payment-utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-status";
import { canAllocatePayment, canCancelPayment, canEditPayment } from "@/lib/payment-status";
import { isPositive } from "@/lib/money";
import { formatCurrency } from "@/lib/pricing";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import {
  autoAllocatePaymentAction,
  cancelPaymentAction,
  deallocatePaymentFromInvoiceAction,
} from "@/server/actions/payment-allocation.actions";
import { generatePaymentReceiptAction, sendPaymentReceiptEmailAction } from "@/server/actions/payment-receipt.actions";

type PaymentDetail = {
  id: string;
  paymentNumber: string;
  status: PaymentStatus;
  method: PaymentMethod;
  paymentDate: Date;
  amount: MoneyInput;
  allocatedAmount: MoneyInput;
  unallocatedAmount: MoneyInput;
  currency: string;
  reference: string | null;
  bankReference: string | null;
  checkNumber: string | null;
  cardLast4: string | null;
  notes: string | null;
  internalNotes: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  customer: { id: string; name: string; email: string | null };
  allocations: {
    id: string;
    amount: MoneyInput;
    allocatedAt: Date;
    invoice: {
      id: string;
      invoiceNumber: string;
      issueDate: Date;
      dueDate: Date;
      totalIncludingTax: MoneyInput;
      amountPaid: MoneyInput;
      amountDue: MoneyInput;
      paymentStatus: string;
      status: string;
      currency: string;
    };
  }[];
  activities: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    createdAt: Date;
    user: { name: string } | null;
  }[];
};

export function PaymentDetailClient({
  user,
  payment,
  accountingEntry = null,
}: {
  user: SessionUser;
  payment: PaymentDetail;
  accountingEntry?: {
    id: string;
    entryNumber: string;
    status: string;
    journal: { code: string };
    entryDate: Date;
  } | null;
}) {
  const router = useRouter();
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(payment.customer.email ?? "");
  const [emailSubject, setEmailSubject] = useState(`Reçu de paiement ${payment.paymentNumber}`);
  const [emailMessage, setEmailMessage] = useState(
    `Bonjour,\n\nVeuillez trouver ci-joint le reçu de votre paiement ${payment.paymentNumber}.\n\nCordialement,\nNova Gestion`,
  );

  async function handleReceipt() {
    const result = await generatePaymentReceiptAction(payment.id);
    if (result.success && result.receiptUrl) window.open(result.receiptUrl, "_blank");
    else toast.error(result.error ?? "Erreur");
    router.refresh();
  }

  async function handleAutoAllocate() {
    const result = await autoAllocatePaymentAction(payment.id);
    if (result.success) {
      toast.success("Allocation automatique effectuée");
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  async function handleDeallocate(invoiceId: string) {
    if (!confirm("Désallouer ce paiement de cette facture ?")) return;
    const result = await deallocatePaymentFromInvoiceAction({ paymentId: payment.id, invoiceId });
    if (result.success) {
      toast.success("Désallocation effectuée");
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  async function handleCancel() {
    const reason = prompt("Raison de l'annulation (min. 3 caractères) :");
    if (!reason || reason.length < 3) return;
    const result = await cancelPaymentAction({ paymentId: payment.id, reason });
    if (result.success) {
      toast.success(result.message ?? "Paiement annulé");
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  async function handleSendEmail() {
    const result = await sendPaymentReceiptEmailAction(payment.id, {
      recipient: emailRecipient,
      subject: emailSubject,
      message: emailMessage,
    });
    if (result.success) {
      toast.success(result.message);
      setEmailOpen(false);
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold font-mono">{payment.paymentNumber}</h1>
            <PaymentStatusBadge status={payment.status} />
            <PaymentMethodBadge method={payment.method} />
          </div>
          <p className="mt-1 text-[var(--color-muted-foreground)]">
            {payment.customer.name} — {formatDateShort(payment.paymentDate)} —{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(payment.amount, payment.currency)}
            </span>
          </p>
          {payment.status === "CANCELLED" && payment.cancellationReason && (
            <p className="mt-2 text-sm text-destructive">
              Annulé : {payment.cancellationReason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditPayment(payment.status) && (
            <PermissionGate user={user} permission="PAYMENTS_UPDATE">
              <Button variant="outline" asChild>
                <Link href={`/payments/${payment.id}/edit`}><Edit className="h-4 w-4" /> Modifier</Link>
              </Button>
            </PermissionGate>
          )}
          {canAllocatePayment(payment.status) && isPositive(payment.unallocatedAmount) && (
            <PermissionGate user={user} permission="PAYMENTS_UPDATE">
              <Button variant="outline" onClick={handleAutoAllocate}>Allouer automatiquement</Button>
            </PermissionGate>
          )}
          {payment.status !== "CANCELLED" && (
            <>
              <Button variant="outline" onClick={handleReceipt}><Printer className="h-4 w-4" /> Générer reçu</Button>
              <Button variant="outline" onClick={() => setEmailOpen(true)}><Mail className="h-4 w-4" /> Envoyer le reçu par email</Button>
            </>
          )}
          {canCancelPayment(payment.status) && (
            <PermissionGate user={user} permission="PAYMENTS_CANCEL">
              <Button variant="destructive" onClick={handleCancel}><X className="h-4 w-4" /> Annuler</Button>
            </PermissionGate>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Montant</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(payment.amount, payment.currency)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Alloué</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-emerald-600">{formatCurrency(payment.allocatedAmount, payment.currency)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Non alloué</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-amber-600">{formatCurrency(payment.unallocatedAmount, payment.currency)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-2 text-sm">
              <p><span className="text-[var(--color-muted-foreground)]">Client :</span> {payment.customer.name}</p>
              <p><span className="text-[var(--color-muted-foreground)]">Date :</span> {formatDateShort(payment.paymentDate)}</p>
              <p><span className="text-[var(--color-muted-foreground)]">Mode :</span> {PAYMENT_METHOD_LABELS[payment.method]}</p>
              <p><span className="text-[var(--color-muted-foreground)]">Référence :</span> {payment.reference ?? "—"}</p>
              <p><span className="text-[var(--color-muted-foreground)]">Réf. bancaire :</span> {payment.bankReference ?? "—"}</p>
              {payment.checkNumber && <p><span className="text-[var(--color-muted-foreground)]">N° chèque :</span> {payment.checkNumber}</p>}
              {payment.cardLast4 && <p><span className="text-[var(--color-muted-foreground)]">Carte :</span> **** {payment.cardLast4}</p>}
              {payment.notes && <p className="md:col-span-2"><span className="text-[var(--color-muted-foreground)]">Notes :</span> {payment.notes}</p>}
            </CardContent>
          </Card>
          <div className="mt-4">
            <AccountingSourceSection
              user={user}
              sourceType="CUSTOMER_PAYMENT"
              sourceId={payment.id}
              entry={accountingEntry}
            />
          </div>
          {payment.internalNotes && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Notes internes</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{payment.internalNotes}</p></CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="allocations" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Factures liées</CardTitle></CardHeader>
            <CardContent>
              {payment.allocations.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">Aucune allocation pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {payment.allocations.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 rounded border p-3">
                      <div>
                        <Link href={`/invoices/${a.invoice.id}`} className="font-mono font-medium hover:underline">
                          {a.invoice.invoiceNumber}
                        </Link>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          Total {formatCurrency(a.invoice.totalIncludingTax, a.invoice.currency)} — Reste {formatCurrency(a.invoice.amountDue, a.invoice.currency)}
                        </p>
                        <InvoicePaymentStatusBadge status={a.invoice.paymentStatus as "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE"} />
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(a.amount, payment.currency)}</p>
                        {payment.status !== "CANCELLED" && (
                          <PermissionGate user={user} permission="PAYMENTS_UPDATE">
                            <Button variant="ghost" size="sm" onClick={() => handleDeallocate(a.invoice.id)}>
                              Désallouer
                            </Button>
                          </PermissionGate>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {payment.activities.map((a) => (
                <div key={a.id} className="border-l-2 border-blue-200 pl-4">
                  <p className="font-medium">{a.title}</p>
                  {a.description && <p className="text-sm text-[var(--color-muted-foreground)]">{a.description}</p>}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {PAYMENT_ACTIVITY_TYPE_LABELS[a.type] ?? a.type} — {formatDateShort(a.createdAt)}
                    {a.user ? ` — ${a.user.name}` : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />
      <Button variant="outline" asChild><Link href="/payments">← Retour à la liste</Link></Button>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Simuler l{"'"}envoi du reçu</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destinataire</Label>
              <Input value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Objet</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} rows={5} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEmailOpen(false)}>Annuler</Button>
              <Button onClick={handleSendEmail}>Envoyer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
