import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoicePaymentStatusBadge, InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/invoices/invoice-badges";
import { InvoiceTotals } from "@/components/invoices/invoice-totals";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { formatCurrency, formatVatRate } from "@/lib/pricing";
import { formatDateShort } from "@/lib/utils";
import type { InvoicePaymentStatus, InvoiceStatus } from "@prisma/client";
import type { MoneyInput } from "@/lib/money";
import { moneyToNumber } from "@/lib/money";
import { organizationNameForDocuments } from "@/lib/organization-display";

type InvoicePreviewProps = {
  invoice: {
    invoiceNumber: string;
    title: string;
    subject: string | null;
    type: string;
    status: InvoiceStatus;
    paymentStatus: InvoicePaymentStatus;
    issueDate: Date;
    dueDate: Date;
    currency: string;
    paymentTermsDays: number;
    introductionText: string | null;
    footerText: string | null;
    customerNotes: string | null;
    globalDiscountType: string | null;
    globalDiscountValue: MoneyInput;
    shippingAmountExcludingTax: MoneyInput;
    otherFeesExcludingTax: MoneyInput;
    amountPaid: MoneyInput;
    amountDue: MoneyInput;
    totalIncludingTax: MoneyInput;
    customer: { name: string; email: string | null };
    customerContact: { firstName: string; lastName: string; email: string | null } | null;
    billingAddress: {
      addressLine1: string;
      addressLine2: string | null;
      postalCode: string;
      city: string;
      country: string;
    } | null;
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
      vatRate: MoneyInput;
    }[];
  };
  organization: {
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
  } | null;
  compact?: boolean;
  showPaymentSummary?: boolean;
};

export function InvoicePreview({ invoice, organization, compact, showPaymentSummary = true }: InvoicePreviewProps) {
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

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          {organization && (
            <>
              <p className="text-lg font-bold">
                {organizationNameForDocuments(organization)}
              </p>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {organization.addressLine1}
                {organization.addressLine2 ? `, ${organization.addressLine2}` : ""}
                <br />
                {organization.postalCode} {organization.city}
              </p>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">FACTURE</p>
          <p className="font-mono">{invoice.invoiceNumber}</p>
          {!compact && (
            <div className="mt-2 flex justify-end gap-2">
              <InvoiceTypeBadge type={invoice.type} />
              <InvoiceStatusBadge status={invoice.status} />
              <InvoicePaymentStatusBadge status={invoice.paymentStatus} />
            </div>
          )}
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Émise le {formatDateShort(invoice.issueDate)}
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Échéance : {formatDateShort(invoice.dueDate)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Client</p>
          <p className="font-medium">{invoice.customer.name}</p>
          {invoice.billingAddress && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {invoice.billingAddress.addressLine1}
              <br />
              {invoice.billingAddress.postalCode} {invoice.billingAddress.city}
            </p>
          )}
        </div>
        <div>
          {invoice.subject && <p className="text-sm">{invoice.subject}</p>}
          <p className="text-sm">Délai de paiement : {invoice.paymentTermsDays} jours</p>
        </div>
      </div>

      {showPaymentSummary && moneyToNumber(invoice.amountDue) >= 0 && (
        <div className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-3">
          <p>Total TTC : <strong>{formatCurrency(invoice.totalIncludingTax, invoice.currency)}</strong></p>
          <p>Payé : <strong className="text-emerald-700">{formatCurrency(invoice.amountPaid, invoice.currency)}</strong></p>
          <p>Reste à payer : <strong className="text-amber-700">{formatCurrency(invoice.amountDue, invoice.currency)}</strong></p>
        </div>
      )}

      {invoice.introductionText && (
        <p className="mb-4 text-sm whitespace-pre-wrap">{invoice.introductionText}</p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Réf.</TableHead>
            <TableHead>Désignation</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">P.U. HT</TableHead>
            <TableHead className="text-right">TVA</TableHead>
            <TableHead className="text-right">Total HT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totals.lines.map((line, i) => {
            const src = invoice.lines[i];
            const isNonBillable = line.lineType === "SECTION" || line.lineType === "COMMENT";
            if (isNonBillable) {
              return (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="bg-slate-50 font-semibold">{src.name}</TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{src.reference ?? "—"}</TableCell>
                <TableCell>
                  <div>{src.name}</div>
                  {src.description && <div className="text-xs text-[var(--color-muted-foreground)]">{src.description}</div>}
                </TableCell>
                <TableCell className="text-right">{moneyToNumber(src.quantity)} {src.unit}</TableCell>
                <TableCell className="text-right">{formatCurrency(src.unitPriceExcludingTax, invoice.currency)}</TableCell>
                <TableCell className="text-right">{formatVatRate(src.vatRate)}</TableCell>
                <TableCell className="text-right">{formatCurrency(line.totalExcludingTax, invoice.currency)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs">
          <InvoiceTotals
            totals={totals}
            currency={invoice.currency}
            shippingAmount={invoice.shippingAmountExcludingTax}
            otherFees={invoice.otherFeesExcludingTax}
          />
        </div>
      </div>

      {invoice.footerText && (
        <p className="mt-4 text-xs text-[var(--color-muted-foreground)] whitespace-pre-wrap">{invoice.footerText}</p>
      )}
    </div>
  );
}
