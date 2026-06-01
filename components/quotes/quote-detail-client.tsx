"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  Copy,
  Edit,
  FileText,
  Mail,
  Printer,
  RefreshCw,
  X,
} from "lucide-react";
import type { QuoteStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGate } from "@/components/shared/permission-gate";
import { QuotePreview } from "@/components/quotes/quote-preview";
import { QuoteSendDialog } from "@/components/quotes/quote-send-dialog";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { QuoteTotals } from "@/components/quotes/quote-totals";
import { calculateQuoteTotals } from "@/lib/quote-calculations";
import { formatCurrency } from "@/lib/pricing";
import {
  canAcceptQuote,
  canCancelQuote,
  canConvertQuote,
  canRefuseQuote,
  isQuoteEditable,
} from "@/lib/quote-status";
import { QUOTE_ACTIVITY_TYPE_LABELS } from "@/lib/quote-utils";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import { archiveQuoteAction, duplicateQuoteAction, reactivateQuoteAction } from "@/server/actions/quote.actions";
import {
  acceptQuoteAction,
  cancelQuoteAction,
  convertQuoteToInvoiceAction,
  generateQuotePrintAction,
  refuseQuoteAction,
} from "@/server/actions/quote-status.actions";

type QuoteDetail = {
  id: string;
  quoteNumber: string;
  title: string;
  subject: string | null;
  status: QuoteStatus;
  issueDate: Date;
  validUntil: Date;
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
  isArchived: boolean;
  customer: { id: string; name: string; email: string | null };
  customerContact: { firstName: string; lastName: string; email: string | null } | null;
  billingAddress: {
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string;
    city: string;
    country: string;
  } | null;
  shippingAddress: {
    addressLine1: string;
    city: string;
  } | null;
  createdBy: { name: string } | null;
  lines: {
    lineType: string;
    reference: string | null;
    name: string;
    description: string | null;
    quantity: MoneyInput;
    unit: string;
    unitPriceExcludingTax: MoneyInput;
    discountType: string | null;
    discountValue: MoneyInput;
    discountAmount: MoneyInput;
    vatRate: MoneyInput;
    totalExcludingTax: MoneyInput;
    totalIncludingTax: MoneyInput;
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

type OrgInfo = {
  name: string;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  vatNumber: string | null;
  logoUrl: string | null;
};

type QuoteDetailClientProps = {
  user: SessionUser;
  quote: QuoteDetail;
  organization: OrgInfo | null;
};

export function QuoteDetailClient({ user, quote, organization }: QuoteDetailClientProps) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);

  const totals = calculateQuoteTotals({
    lines: quote.lines.map((l) => ({
      lineType: l.lineType as "ITEM" | "SERVICE" | "FREE_TEXT" | "SECTION" | "COMMENT",
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountType: l.discountType as "PERCENTAGE" | "FIXED_AMOUNT" | null,
      discountValue: l.discountValue,
      vatRate: l.vatRate,
    })),
    globalDiscountType: quote.globalDiscountType as "PERCENTAGE" | "FIXED_AMOUNT" | null,
    globalDiscountValue: quote.globalDiscountValue,
    shippingAmountExcludingTax: quote.shippingAmountExcludingTax,
    otherFeesExcludingTax: quote.otherFeesExcludingTax,
  });

  async function runAction(
    action: () => Promise<{
      success: boolean;
      error?: string;
      message?: string;
      printUrl?: string;
      downloadUrl?: string;
      quoteId?: string;
    }>,
    defaultMsg: string,
  ) {
    const result = await action();
    if (result.success) {
      toast.success(result.message ?? defaultMsg);
      if (result.downloadUrl) window.open(result.downloadUrl, "_blank");
      else if (result.printUrl) window.open(result.printUrl, "_blank");
      if ("invoiceId" in result && result.invoiceId) router.push(`/invoices/${result.invoiceId}`);
      if (result.quoteId) router.push(`/quotes/${result.quoteId}`);
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
            <h1 className="text-2xl font-bold font-mono">{quote.quoteNumber}</h1>
            <QuoteStatusBadge status={quote.status} />
            {quote.isArchived && <Badge variant="outline">Archivé</Badge>}
          </div>
          <p className="mt-1 text-lg">{quote.title}</p>
          <p className="text-[var(--color-muted-foreground)]">
            {quote.customer.name} — Validité : {formatDateShort(quote.validUntil)} —{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(quote.totalIncludingTax, quote.currency)} TTC
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isQuoteEditable(quote.status) && (
            <PermissionGate user={user} permission="QUOTES_UPDATE">
              <Button variant="outline" asChild>
                <Link href={`/quotes/${quote.id}/edit`}><Edit className="h-4 w-4" /> Modifier</Link>
              </Button>
            </PermissionGate>
          )}
          <PermissionGate user={user} permission="QUOTES_CREATE">
            <Button variant="outline" onClick={() => runAction(() => duplicateQuoteAction(quote.id), "Devis dupliqué")}>
              <Copy className="h-4 w-4" /> Dupliquer
            </Button>
          </PermissionGate>
          <Button variant="outline" onClick={() => runAction(() => generateQuotePrintAction(quote.id), "PDF généré")}>
            <Printer className="h-4 w-4" /> PDF
          </Button>
          <PermissionGate user={user} permission="QUOTES_UPDATE">
            <Button variant="outline" onClick={() => setSendOpen(true)}>
              <Mail className="h-4 w-4" /> Envoyer par email
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission="QUOTES_VALIDATE">
            {canAcceptQuote(quote.status) && (
              <Button onClick={() => runAction(() => acceptQuoteAction(quote.id), "Devis accepté")}>
                <Check className="h-4 w-4" /> Accepter
              </Button>
            )}
            {canRefuseQuote(quote.status) && (
              <Button variant="destructive" onClick={() => runAction(() => refuseQuoteAction(quote.id), "Devis refusé")}>
                <X className="h-4 w-4" /> Refuser
              </Button>
            )}
            {canCancelQuote(quote.status) && (
              <Button variant="outline" onClick={() => runAction(() => cancelQuoteAction(quote.id), "Devis annulé")}>
                Annuler
              </Button>
            )}
            {canConvertQuote(quote.status) && (
              <Button variant="outline" onClick={() => runAction(() => convertQuoteToInvoiceAction(quote.id), "Facture créée")}>
                <RefreshCw className="h-4 w-4" /> Convertir en facture
              </Button>
            )}
          </PermissionGate>
          <PermissionGate user={user} permission="QUOTES_DELETE">
            {quote.isArchived ? (
              <Button variant="outline" onClick={() => runAction(() => reactivateQuoteAction(quote.id), "Devis réactivé")}>
                <Archive className="h-4 w-4" /> Réactiver
              </Button>
            ) : (
              <Button variant="outline" onClick={() => runAction(() => archiveQuoteAction(quote.id), "Devis archivé")}>
                <Archive className="h-4 w-4" /> Archiver
              </Button>
            )}
          </PermissionGate>
        </div>
      </div>

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview"><FileText className="mr-2 h-4 w-4" /> Prévisualisation</TabsTrigger>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <QuotePreview quote={quote} organization={organization} />
        </TabsContent>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-[var(--color-muted-foreground)]">Client :</span> {quote.customer.name}</p>
                {quote.customerContact && (
                  <p>
                    <span className="text-[var(--color-muted-foreground)]">Contact :</span>{" "}
                    {quote.customerContact.firstName} {quote.customerContact.lastName}
                  </p>
                )}
                <p><span className="text-[var(--color-muted-foreground)]">Émission :</span> {formatDateShort(quote.issueDate)}</p>
                <p><span className="text-[var(--color-muted-foreground)]">Validité :</span> {formatDateShort(quote.validUntil)}</p>
                <p><span className="text-[var(--color-muted-foreground)]">Créateur :</span> {quote.createdBy?.name ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Totaux</CardTitle></CardHeader>
              <CardContent>
                <QuoteTotals
                  totals={totals}
                  currency={quote.currency}
                  shippingAmount={quote.shippingAmountExcludingTax}
                  otherFees={quote.otherFeesExcludingTax}
                />
              </CardContent>
            </Card>
          </div>
          {quote.internalNotes && (
            <Card>
              <CardHeader><CardTitle>Notes internes</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{quote.internalNotes}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
              <CardHeader><CardTitle>Historique d{"'"}activité</CardTitle></CardHeader>
            <CardContent>
              {quote.activities.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">Aucune activité.</p>
              ) : (
                <div className="space-y-4">
                  {quote.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4 border-l-2 border-blue-200 pl-4">
                      <div className="flex-1">
                        <p className="font-medium">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-[var(--color-muted-foreground)]">{activity.description}</p>
                        )}
                        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                          {QUOTE_ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type} —{" "}
                          {formatDateShort(activity.createdAt)}
                          {activity.user && ` — ${activity.user.name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      <Button variant="outline" asChild>
        <Link href="/quotes">← Retour à la liste</Link>
      </Button>

      <QuoteSendDialog
        quoteId={quote.id}
        quoteNumber={quote.quoteNumber}
        defaultRecipient={quote.customerContact?.email ?? quote.customer.email}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
