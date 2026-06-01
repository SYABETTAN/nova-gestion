"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  CreditCard,
  Download,
  Edit,
  X,
} from "lucide-react";
import { UploadSupplierAttachmentDialog } from "@/components/attachments/upload-supplier-attachment-dialog";
import { getSupplierAttachmentApiPath } from "@/lib/files";
import type { PermissionKey } from "@prisma/client";
import type {
  SupplierInvoicePaymentStatus,
  SupplierInvoiceStatus,
} from "@/components/supplier-invoices/supplier-invoice-badges";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import { AccountingSourceSection } from "@/components/accounting/accounting-entry-detail-client";
import {
  SupplierInvoicePaymentStatusBadge,
  SupplierInvoiceStatusBadge,
  SupplierInvoiceTypeBadge,
} from "@/components/supplier-invoices/supplier-invoice-badges";
import { SupplierInvoiceTotals } from "@/components/supplier-invoices/supplier-invoice-totals";
import { calculateSupplierInvoiceTotals } from "@/lib/supplier-invoice-calculations";
import {
  canCancelSupplierInvoice,
  canMarkSupplierInvoiceOverdue,
  canMarkSupplierInvoicePaid,
  canMarkSupplierInvoicePartiallyPaid,
  canValidateSupplierInvoice,
  isSupplierInvoiceEditable,
} from "@/lib/supplier-invoice-status";
import { SUPPLIER_INVOICE_ACTIVITY_LABELS } from "@/lib/supplier-invoice-utils";
import { formatCurrency } from "@/lib/pricing";
import { simulatedActionsVisible } from "@/lib/client-env";
import { isPositive, moneyToNumber } from "@/lib/money";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import {
  archiveSupplierInvoiceAction,
  reactivateSupplierInvoiceAction,
} from "@/server/actions/supplier-invoice.actions";
import {
  cancelSupplierInvoiceAction,
  markSupplierInvoiceOverdueAction,
  markSupplierInvoicePaidPlaceholderAction,
  markSupplierInvoicePartiallyPaidPlaceholderAction,
  validateSupplierInvoiceAction,
} from "@/server/actions/supplier-invoice-status.actions";

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE_PDF: "Facture PDF",
  RECEIPT: "Justificatif",
  CONTRACT: "Contrat",
  OTHER: "Autre",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Virement",
  CARD: "Carte",
  CHECK: "Chèque",
  CASH: "Espèces",
  DIRECT_DEBIT: "Prélèvement",
  OTHER: "Autre",
};

type SupplierInvoiceDetail = {
  id: string;
  supplierInvoiceNumber: string;
  supplierReference: string | null;
  title: string;
  description: string | null;
  type: string;
  status: SupplierInvoiceStatus;
  paymentStatus: SupplierInvoicePaymentStatus;
  issueDate: Date;
  receivedDate: Date;
  dueDate: Date;
  validatedAt: Date | null;
  cancelledAt: Date | null;
  paidAt: Date | null;
  currency: string;
  paymentTermsDays: number;
  defaultVatRate: MoneyInput;
  expenseCategoryId: string | null;
  paymentMethodPlaceholder: string | null;
  internalNotes: string | null;
  subtotalExcludingTax: MoneyInput;
  totalDiscountAmount: MoneyInput;
  totalExcludingTax: MoneyInput;
  totalVatAmount: MoneyInput;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  isArchived: boolean;
  supplier: { id: string; name: string; supplierNumber: string };
  expenseCategory: { name: string } | null;
  lines: {
    position: number;
    reference: string | null;
    name: string;
    description: string | null;
    quantity: MoneyInput;
    unit: string;
    unitPriceExcludingTax: MoneyInput;
    discountAmount: MoneyInput;
    vatRate: MoneyInput;
    totalExcludingTax: MoneyInput;
    totalVatAmount: MoneyInput;
    totalIncludingTax: MoneyInput;
    expenseCategory: { name: string } | null;
  }[];
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    type: string;
    createdAt: Date;
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

export function SupplierInvoiceDetailClient({
  user,
  invoice,
  accountingEntry = null,
}: {
  user: SessionUser;
  invoice: SupplierInvoiceDetail;
  accountingEntry?: {
    id: string;
    entryNumber: string;
    status: string;
    journal: { code: string };
    entryDate: Date;
  } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [partialLoading, setPartialLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("cancel") === "1") setCancelOpen(true);
    if (searchParams.get("partial") === "1") setPartialOpen(true);
  }, [searchParams]);

  const totals = calculateSupplierInvoiceTotals(
    invoice.lines.map((l) => ({
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountAmount: l.discountAmount,
      vatRate: l.vatRate,
    })),
    invoice.amountPaid,
  );

  async function runAction(
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    defaultMsg: string,
  ) {
    const result = await action();
    if (result.success) {
      toast.success(result.message ?? defaultMsg);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleCancel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCancelLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await cancelSupplierInvoiceAction(invoice.id, formData);
    setCancelLoading(false);
    if (result.success) {
      toast.success("Facture annulée");
      setCancelOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handlePartialPay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPartialLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await markSupplierInvoicePartiallyPaidPlaceholderAction(invoice.id, formData);
    setPartialLoading(false);
    if (result.success) {
      toast.success("Paiement partiel enregistré");
      setPartialOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold font-mono">{invoice.supplierInvoiceNumber}</h1>
            <SupplierInvoiceTypeBadge type={invoice.type} />
            <SupplierInvoiceStatusBadge status={invoice.status} />
            <SupplierInvoicePaymentStatusBadge status={invoice.paymentStatus} />
            {invoice.isArchived && <Badge variant="secondary">Archivée</Badge>}
          </div>
          <p className="mt-1 text-lg">{invoice.title}</p>
          <p className="text-[var(--color-muted-foreground)]">
            <Link href={`/suppliers/${invoice.supplier.id}`} className="hover:underline">
              {invoice.supplier.name}
            </Link>
            {invoice.supplierReference && (
              <> — Réf. {invoice.supplierReference}</>
            )}
            {" "}
            — Échéance {formatDateShort(invoice.dueDate)} —{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(invoice.totalIncludingTax, invoice.currency)} TTC
            </span>
          </p>
          {invoice.validatedAt && (
            <p className="mt-2 text-sm text-amber-700">
              Facture verrouillée après validation — modification directe désactivée.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isSupplierInvoiceEditable(invoice.status) && (
            <PermissionGate user={user} permission={"SUPPLIER_INVOICES_UPDATE" as PermissionKey}>
              <Button variant="outline" asChild>
                <Link href={`/supplier-invoices/${invoice.id}/edit`}>
                  <Edit className="h-4 w-4" /> Modifier
                </Link>
              </Button>
            </PermissionGate>
          )}
          {canValidateSupplierInvoice(invoice.status) && (
            <PermissionGate user={user} permission={"SUPPLIER_INVOICES_VALIDATE" as PermissionKey}>
              <Button
                onClick={() =>
                  runAction(() => validateSupplierInvoiceAction(invoice.id), "Facture validée")
                }
              >
                <Check className="h-4 w-4" /> Valider
              </Button>
            </PermissionGate>
          )}
          <PermissionGate user={user} permission={"SUPPLIER_INVOICES_UPDATE" as PermissionKey}>
            {simulatedActionsVisible() && canMarkSupplierInvoicePaid(invoice.status) && invoice.paymentStatus !== "PAID" && (
              <Button
                variant="outline"
                onClick={() =>
                  runAction(
                    () => markSupplierInvoicePaidPlaceholderAction(invoice.id),
                    "Facture marquée payée",
                  )
                }
              >
                <CreditCard className="h-4 w-4" /> Marquer payée
              </Button>
            )}
            {simulatedActionsVisible() && canMarkSupplierInvoicePartiallyPaid(invoice.status) && isPositive(invoice.amountDue) && (
              <Button variant="outline" onClick={() => setPartialOpen(true)}>
                Paiement partiel
              </Button>
            )}
            {canMarkSupplierInvoiceOverdue(invoice.status) && (
              <Button
                variant="outline"
                onClick={() =>
                  runAction(
                    () => markSupplierInvoiceOverdueAction(invoice.id),
                    "Marquée en retard",
                  )
                }
              >
                En retard
              </Button>
            )}
          </PermissionGate>
          <PermissionGate user={user} permission={"SUPPLIER_INVOICES_CANCEL" as PermissionKey}>
            {canCancelSupplierInvoice(invoice.status) && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <X className="h-4 w-4" /> Annuler
              </Button>
            )}
          </PermissionGate>
          <PermissionGate user={user} permission={"SUPPLIER_INVOICES_UPDATE" as PermissionKey}>
            {invoice.isArchived ? (
              <Button
                variant="outline"
                onClick={() =>
                  runAction(() => reactivateSupplierInvoiceAction(invoice.id), "Réactivée")
                }
              >
                <Archive className="h-4 w-4" /> Réactiver
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  runAction(() => archiveSupplierInvoiceAction(invoice.id), "Archivée")
                }
              >
                <Archive className="h-4 w-4" /> Archiver
              </Button>
            )}
          </PermissionGate>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="lines">Lignes</TabsTrigger>
          <TabsTrigger value="attachments">Pièces jointes</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-[var(--color-muted-foreground)]">Fournisseur :</span>{" "}
                  <Link href={`/suppliers/${invoice.supplier.id}`} className="font-medium hover:underline">
                    {invoice.supplier.name}
                  </Link>
                </p>
                <p>
                  <span className="text-[var(--color-muted-foreground)]">Date facture :</span>{" "}
                  {formatDateShort(invoice.issueDate)}
                </p>
                <p>
                  <span className="text-[var(--color-muted-foreground)]">Date réception :</span>{" "}
                  {formatDateShort(invoice.receivedDate)}
                </p>
                <p>
                  <span className="text-[var(--color-muted-foreground)]">Échéance :</span>{" "}
                  {formatDateShort(invoice.dueDate)} ({invoice.paymentTermsDays} jours)
                </p>
                {invoice.expenseCategory && (
                  <p>
                    <span className="text-[var(--color-muted-foreground)]">Catégorie :</span>{" "}
                    {invoice.expenseCategory.name}
                  </p>
                )}
                {invoice.paymentMethodPlaceholder && (
                  <p>
                    <span className="text-[var(--color-muted-foreground)]">Mode paiement :</span>{" "}
                    {PAYMENT_METHOD_LABELS[invoice.paymentMethodPlaceholder] ??
                      invoice.paymentMethodPlaceholder}
                  </p>
                )}
                {invoice.description && (
                  <p className="whitespace-pre-wrap">{invoice.description}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Totaux</CardTitle>
              </CardHeader>
              <CardContent>
                <SupplierInvoiceTotals totals={totals} currency={invoice.currency} />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Suivi paiement</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-3">
              <p>
                Total :{" "}
                <strong>{formatCurrency(invoice.totalIncludingTax, invoice.currency)}</strong>
              </p>
              <p>
                Payé :{" "}
                <strong className="text-emerald-600">
                  {formatCurrency(invoice.amountPaid, invoice.currency)}
                </strong>
              </p>
              <p>
                Reste à payer :{" "}
                <strong className="text-amber-600">
                  {formatCurrency(invoice.amountDue, invoice.currency)}
                </strong>
              </p>
            </CardContent>
          </Card>
          <AccountingSourceSection
            user={user}
            sourceType="SUPPLIER_INVOICE"
            sourceId={invoice.id}
            entry={accountingEntry}
          />
          {invoice.internalNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes internes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{invoice.internalNotes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lines" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Lignes ({invoice.lines.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead className="text-right">Prix HT</TableHead>
                    <TableHead className="text-right">Remise</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((line, i) => (
                    <TableRow key={line.position}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <p className="font-medium">{line.name}</p>
                        {line.reference && (
                          <p className="text-xs text-[var(--color-muted-foreground)]">
                            {line.reference}
                          </p>
                        )}
                        {line.expenseCategory && (
                          <p className="text-xs text-[var(--color-muted-foreground)]">
                            {line.expenseCategory.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {moneyToNumber(line.quantity)} {line.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(line.unitPriceExcludingTax, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPositive(line.discountAmount)
                          ? formatCurrency(line.discountAmount, invoice.currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">{moneyToNumber(line.vatRate)} %</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.totalIncludingTax, invoice.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pièces jointes</CardTitle>
              <PermissionGate user={user} permission="SUPPLIER_INVOICES_UPDATE">
                <UploadSupplierAttachmentDialog supplierInvoiceId={invoice.id} />
              </PermissionGate>
            </CardHeader>
            <CardContent>
              {invoice.attachments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  Aucune pièce jointe enregistrée.
                </p>
              ) : (
                <div className="space-y-3">
                  {invoice.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded border p-3"
                    >
                      <div>
                        <p className="font-medium">{att.fileName}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {ATTACHMENT_TYPE_LABELS[att.type] ?? att.type} — {att.mimeType} —{" "}
                          {(att.sizeBytes / 1024).toFixed(1)} Ko —{" "}
                          {formatDateShort(att.createdAt)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={getSupplierAttachmentApiPath(att.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4" /> Télécharger
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoice.activities.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">Aucune activité.</p>
              ) : (
                invoice.activities.map((a) => (
                  <div key={a.id} className="border-l-2 border-cyan-200 pl-4">
                    <p className="font-medium">{a.title}</p>
                    {a.description && (
                      <p className="text-sm text-[var(--color-muted-foreground)]">{a.description}</p>
                    )}
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {SUPPLIER_INVOICE_ACTIVITY_LABELS[a.type] ?? a.type}
                      {a.user ? ` — ${a.user.name}` : ""} — {formatDateShort(a.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />
      <Button variant="outline" asChild>
        <Link href="/supplier-invoices">← Retour à la liste</Link>
      </Button>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la facture</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCancel} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motif d{"'"}annulation *</Label>
              <Textarea
                id="reason"
                name="reason"
                rows={3}
                required
                minLength={3}
                placeholder="Indiquez la raison de l'annulation..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
                Fermer
              </Button>
              <Button type="submit" variant="destructive" disabled={cancelLoading}>
                {cancelLoading ? "Annulation..." : "Confirmer l'annulation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={partialOpen} onOpenChange={setPartialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paiement partiel</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Reste à payer : {formatCurrency(invoice.amountDue, invoice.currency)} — Total TTC :{" "}
            {formatCurrency(invoice.totalIncludingTax, invoice.currency)}
          </p>
          <form onSubmit={handlePartialPay} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant payé (€) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0.01}
                step={0.01}
                max={moneyToNumber(invoice.totalIncludingTax) - 0.01}
                required
                placeholder="Montant inférieur au total TTC"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPartialOpen(false)}>
                Fermer
              </Button>
              <Button type="submit" disabled={partialLoading}>
                {partialLoading ? "Enregistrement..." : "Simuler le paiement"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
