"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, Bell, Check, Copy, CreditCard, Edit, Mail, Printer, X } from "lucide-react";
import type { InvoicePaymentStatus, InvoiceReminderStatus, InvoiceStatus, ReminderLevel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGate } from "@/components/shared/permission-gate";
import { CreditNoteDialog } from "@/components/invoices/credit-note-dialog";
import { InvoicePaymentStatusBadge, InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/invoices/invoice-badges";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { InvoiceSendDialog } from "@/components/invoices/invoice-send-dialog";
import { InvoiceTotals } from "@/components/invoices/invoice-totals";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import {
  canCancelInvoice,
  canCreateCreditNote,
  canMarkPaid,
  canValidateInvoice,
  isInvoiceEditable,
} from "@/lib/invoice-status";
import { INVOICE_ACTIVITY_TYPE_LABELS } from "@/lib/invoice-utils";
import { formatCurrency } from "@/lib/pricing";
import { shouldInvoiceBeReminded } from "@/lib/collection-utils";
import { InvoiceCollectionSection } from "@/components/reminders/invoice-collection-section";
import { AccountingSourceSection } from "@/components/accounting/accounting-entry-detail-client";
import { ReminderSendDialog } from "@/components/reminders/reminder-send-dialog";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-status";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import { archiveInvoiceAction, duplicateInvoiceAction, reactivateInvoiceAction } from "@/server/actions/invoice.actions";
import {
  cancelInvoiceAction,
  generateInvoicePrintAction,
  markInvoiceOverdueAction,
  validateInvoiceAction,
} from "@/server/actions/invoice-status.actions";

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  title: string;
  subject: string | null;
  type: string;
  status: InvoiceStatus;
  paymentStatus: InvoicePaymentStatus;
  issueDate: Date;
  dueDate: Date;
  validatedAt: Date | null;
  currency: string;
  paymentTermsDays: number;
  introductionText: string | null;
  footerText: string | null;
  internalNotes: string | null;
  customerNotes: string | null;
  globalDiscountType: string | null;
  globalDiscountValue: MoneyInput;
  shippingAmountExcludingTax: MoneyInput;
  otherFeesExcludingTax: MoneyInput;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  isArchived: boolean;
  reminderStatus: InvoiceReminderStatus;
  lastReminderAt: Date | null;
  lastReminderLevel: ReminderLevel | null;
  reminderCount: number;
  isCollectionPaused: boolean;
  collectionPausedReason: string | null;
  isDisputed: boolean;
  disputeReason: string | null;
  promisedPaymentDate: Date | null;
  customer: { id: string; name: string; email: string | null };
  customerContact: { firstName: string; lastName: string; email: string | null } | null;
  billingAddress: { addressLine1: string; addressLine2: string | null; postalCode: string; city: string; country: string } | null;
  lines: { lineType: string; reference: string | null; name: string; description: string | null; quantity: MoneyInput; unit: string; unitPriceExcludingTax: MoneyInput; discountType: string | null; discountValue: MoneyInput; vatRate: MoneyInput }[];
  activities: { id: string; type: string; title: string; description: string | null; createdAt: Date; user: { name: string } | null }[];
  creditNotes: { id: string; creditNoteNumber: string; status: string; totalIncludingTax: MoneyInput; reason: string }[];
  quote: { quoteNumber: string } | null;
  paymentAllocations?: {
    id: string;
    amount: MoneyInput;
    allocatedAt: Date;
    payment: {
      id: string;
      paymentNumber: string;
      paymentDate: Date;
      method: string;
      amount: MoneyInput;
      currency: string;
    };
  }[];
};

export function InvoiceDetailClient({
  user,
  invoice,
  organization,
  paymentAllocations = [],
  invoiceReminders = [],
  reminderNotes = [],
  accountingEntry = null,
}: {
  user: SessionUser;
  invoice: InvoiceDetail;
  organization: Parameters<typeof InvoicePreview>[0]["organization"];
  paymentAllocations?: InvoiceDetail["paymentAllocations"];
  accountingEntry?: {
    id: string;
    entryNumber: string;
    status: string;
    journal: { code: string };
    entryDate: Date;
  } | null;
  invoiceReminders?: {
    id: string;
    reminderNumber: string;
    level: string;
    status: string;
    simulatedSentAt: Date | null;
    subject: string;
  }[];
  reminderNotes?: {
    id: string;
    type: string;
    content: string;
    createdAt: Date;
    user: { name: string } | null;
  }[];
}) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const canRemind = shouldInvoiceBeReminded(invoice);

  const totals = calculateInvoiceTotals({
    lines: invoice.lines.map((l) => ({
      lineType: l.lineType as "ITEM" | "SERVICE" | "FREE_TEXT" | "SECTION" | "COMMENT",
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountType: l.discountType as "PERCENTAGE" | "FIXED_AMOUNT" | null,
      discountValue: l.discountValue,
      vatRate: l.vatRate,
    })),
    globalDiscountType: invoice.globalDiscountType as "PERCENTAGE" | "FIXED_AMOUNT" | null,
    globalDiscountValue: invoice.globalDiscountValue,
    shippingAmountExcludingTax: invoice.shippingAmountExcludingTax,
    otherFeesExcludingTax: invoice.otherFeesExcludingTax,
    amountPaid: invoice.amountPaid,
  });

  async function runAction(
    action: () => Promise<{
      success: boolean;
      error?: string;
      message?: string;
      printUrl?: string;
      downloadUrl?: string;
    }>,
    defaultMsg: string,
  ) {
    const result = await action();
    if (result.success) {
      toast.success(result.message ?? defaultMsg);
      if (result.downloadUrl) window.open(result.downloadUrl, "_blank");
      else if (result.printUrl) window.open(result.printUrl, "_blank");
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold font-mono">{invoice.invoiceNumber}</h1>
            <InvoiceTypeBadge type={invoice.type} />
            <InvoiceStatusBadge status={invoice.status} />
            <InvoicePaymentStatusBadge status={invoice.paymentStatus} />
          </div>
          <p className="mt-1 text-lg">{invoice.title}</p>
          <p className="text-[var(--color-muted-foreground)]">
            {invoice.customer.name} — Échéance {formatDateShort(invoice.dueDate)} —{" "}
            <span className="font-semibold text-foreground">{formatCurrency(invoice.totalIncludingTax, invoice.currency)} TTC</span>
          </p>
          {invoice.validatedAt && (
            <p className="mt-2 text-sm text-amber-700">Facture verrouillée après validation.</p>
          )}
          {invoice.quote && (
            <p className="text-sm text-[var(--color-muted-foreground)]">Devis source : {invoice.quote.quoteNumber}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isInvoiceEditable(invoice.status) && (
            <PermissionGate user={user} permission="INVOICES_UPDATE">
              <Button variant="outline" asChild><Link href={`/invoices/${invoice.id}/edit`}><Edit className="h-4 w-4" /> Modifier</Link></Button>
            </PermissionGate>
          )}
          {canValidateInvoice(invoice.status) && (
            <PermissionGate user={user} permission="INVOICES_VALIDATE">
              <Button onClick={() => runAction(() => validateInvoiceAction(invoice.id), "Facture validée")}><Check className="h-4 w-4" /> Valider</Button>
            </PermissionGate>
          )}
          <Button variant="outline" onClick={() => runAction(() => generateInvoicePrintAction(invoice.id), "PDF généré")}><Printer className="h-4 w-4" /> PDF</Button>
          {invoice.status !== "DRAFT" && (
            <PermissionGate user={user} permission="INVOICES_UPDATE">
              <Button variant="outline" onClick={() => setSendOpen(true)}><Mail className="h-4 w-4" /> Envoyer par email</Button>
            </PermissionGate>
          )}
          {canRemind && (
            <PermissionGate user={user} permission="REMINDERS_SEND">
              <Button variant="outline" onClick={() => setReminderOpen(true)}><Bell className="h-4 w-4" /> Relancer</Button>
            </PermissionGate>
          )}
          <PermissionGate user={user} permission="INVOICES_CREATE">
            <Button variant="outline" onClick={() => duplicateInvoiceAction(invoice.id).then((r) => r.success && router.push(`/invoices/${r.invoiceId}`))}><Copy className="h-4 w-4" /> Dupliquer</Button>
          </PermissionGate>
          <PermissionGate user={user} permission="INVOICES_VALIDATE">
            {canMarkPaid(invoice.status) && (
              <PermissionGate user={user} permission="PAYMENTS_CREATE">
                <Button variant="outline" asChild>
                  <Link href={`/payments/new?invoiceId=${invoice.id}`}>
                    <CreditCard className="h-4 w-4" /> Enregistrer un paiement
                  </Link>
                </Button>
              </PermissionGate>
            )}
            {canCreateCreditNote(invoice.status) && (
              <Button variant="outline" onClick={() => setCreditOpen(true)}>Créer avoir</Button>
            )}
            {canCancelInvoice(invoice.status) && (
              <Button variant="destructive" onClick={() => runAction(() => cancelInvoiceAction(invoice.id), "Facture annulée")}><X className="h-4 w-4" /> Annuler</Button>
            )}
            {invoice.status === "SENT" && (
              <Button variant="outline" onClick={() => runAction(() => markInvoiceOverdueAction(invoice.id), "Marquée en retard")}>En retard</Button>
            )}
          </PermissionGate>
          <PermissionGate user={user} permission="INVOICES_CANCEL">
            {invoice.isArchived ? (
              <Button variant="outline" onClick={() => runAction(() => reactivateInvoiceAction(invoice.id), "Réactivée")}><Archive className="h-4 w-4" /> Réactiver</Button>
            ) : (
              <Button variant="outline" onClick={() => runAction(() => archiveInvoiceAction(invoice.id), "Archivée")}><Archive className="h-4 w-4" /> Archiver</Button>
            )}
          </PermissionGate>
        </div>
      </div>

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Prévisualisation</TabsTrigger>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="collection">Recouvrement</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          {invoice.creditNotes.length > 0 && <TabsTrigger value="credits">Avoirs</TabsTrigger>}
        </TabsList>
        <TabsContent value="preview" className="mt-4">
          <InvoicePreview invoice={invoice} organization={organization} />
        </TabsContent>
        <TabsContent value="summary" className="mt-4">
          <Card><CardHeader><CardTitle>Totaux</CardTitle></CardHeader><CardContent><InvoiceTotals totals={totals} currency={invoice.currency} shippingAmount={invoice.shippingAmountExcludingTax} otherFees={invoice.otherFeesExcludingTax} /></CardContent></Card>
          <Card className="mt-4">
            <CardHeader><CardTitle>Suivi paiement</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-3">
              <p>Total : <strong>{formatCurrency(invoice.totalIncludingTax, invoice.currency)}</strong></p>
              <p>Payé : <strong className="text-emerald-600">{formatCurrency(invoice.amountPaid, invoice.currency)}</strong></p>
              <p>Reste à payer : <strong className="text-amber-600">{formatCurrency(invoice.amountDue, invoice.currency)}</strong></p>
            </CardContent>
          </Card>
          <div className="mt-4">
            <AccountingSourceSection
              user={user}
              sourceType="CUSTOMER_INVOICE"
              sourceId={invoice.id}
              entry={accountingEntry}
            />
          </div>
          {invoice.internalNotes && <Card className="mt-4"><CardHeader><CardTitle>Notes internes</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{invoice.internalNotes}</p></CardContent></Card>}
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Paiements liés</CardTitle>
              {canMarkPaid(invoice.status) && (
                <PermissionGate user={user} permission="PAYMENTS_CREATE">
                  <Button size="sm" asChild>
                    <Link href={`/payments/new?invoiceId=${invoice.id}`}>Enregistrer un paiement</Link>
                  </Button>
                </PermissionGate>
              )}
            </CardHeader>
            <CardContent>
              {paymentAllocations.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">Aucun paiement enregistré pour cette facture.</p>
              ) : (
                <div className="space-y-3">
                  {paymentAllocations.map((a) => (
                    <Link key={a.id} href={`/payments/${a.payment.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-slate-50">
                      <div>
                        <p className="font-mono font-medium">{a.payment.paymentNumber}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {formatDateShort(a.payment.paymentDate)} — {PAYMENT_METHOD_LABELS[a.payment.method as keyof typeof PAYMENT_METHOD_LABELS] ?? a.payment.method}
                        </p>
                      </div>
                      <p className="font-semibold">{formatCurrency(a.amount, a.payment.currency)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="collection" className="mt-4">
          <InvoiceCollectionSection
            user={user}
            invoice={invoice}
            reminders={invoiceReminders}
            notes={reminderNotes}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {invoice.activities.map((a) => (
                <div key={a.id} className="border-l-2 border-emerald-200 pl-4">
                  <p className="font-medium">{a.title}</p>
                  {a.description && <p className="text-sm text-[var(--color-muted-foreground)]">{a.description}</p>}
                  <p className="text-xs text-[var(--color-muted-foreground)]">{INVOICE_ACTIVITY_TYPE_LABELS[a.type] ?? a.type} — {formatDateShort(a.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        {invoice.creditNotes.length > 0 && (
          <TabsContent value="credits" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Avoirs liés</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {invoice.creditNotes.map((cn) => (
                  <Link key={cn.id} href={`/credit-notes/${cn.id}`} className="block rounded border p-3 hover:bg-slate-50">
                    <p className="font-mono font-medium">{cn.creditNoteNumber}</p>
                    <p className="text-sm">{cn.reason} — {formatCurrency(cn.totalIncludingTax, invoice.currency)}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Separator />
      <Button variant="outline" asChild><Link href="/invoices">← Retour à la liste</Link></Button>

      <InvoiceSendDialog invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} defaultRecipient={invoice.customerContact?.email ?? invoice.customer.email} open={sendOpen} onOpenChange={setSendOpen} onSuccess={() => router.refresh()} />
      <ReminderSendDialog invoiceId={invoice.id} open={reminderOpen} onOpenChange={setReminderOpen} onSuccess={() => router.refresh()} />
      <CreditNoteDialog invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} totalIncludingTax={invoice.totalIncludingTax} open={creditOpen} onOpenChange={setCreditOpen} onSuccess={(id) => router.push(`/credit-notes/${id}`)} />
    </div>
  );
}
