import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuoteTotals } from "@/components/quotes/quote-totals";
import { calculateQuoteTotals } from "@/lib/quote-calculations";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort } from "@/lib/utils";
import type { MoneyInput } from "@/lib/money";
import { moneyToNumber } from "@/lib/money";

type QuotePreviewProps = {
  quote: {
    quoteNumber: string;
    title: string;
    subject: string | null;
    issueDate: Date;
    validUntil: Date;
    currency: string;
    paymentTermsDays: number;
    introductionText: string | null;
    footerText: string | null;
    customerNotes: string | null;
    globalDiscountType: string | null;
    globalDiscountValue: MoneyInput;
    shippingAmountExcludingTax: MoneyInput;
    otherFeesExcludingTax: MoneyInput;
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
};

export function QuotePreview({ quote, organization, compact }: QuotePreviewProps) {
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

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          {organization && (
            <>
              <p className="text-lg font-bold">{organization.legalName ?? organization.name}</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {organization.addressLine1}
                {organization.addressLine2 ? `, ${organization.addressLine2}` : ""}
                <br />
                {organization.postalCode} {organization.city}
              </p>
              {organization.email && <p className="text-sm">{organization.email}</p>}
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">DEVIS</p>
          <p className="font-mono">{quote.quoteNumber}</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Émis le {formatDateShort(quote.issueDate)}
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Valable jusqu{"'"}au {formatDateShort(quote.validUntil)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Client</p>
          <p className="font-medium">{quote.customer.name}</p>
          {quote.customerContact && (
            <p className="text-sm">
              {quote.customerContact.firstName} {quote.customerContact.lastName}
            </p>
          )}
          {quote.billingAddress && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {quote.billingAddress.addressLine1}
              <br />
              {quote.billingAddress.postalCode} {quote.billingAddress.city}
            </p>
          )}
        </div>
        <div>
          <p className="font-semibold">{quote.title}</p>
          {quote.subject && <p className="text-sm text-[var(--color-muted-foreground)]">{quote.subject}</p>}
          <p className="mt-2 text-sm">Délai de paiement : {quote.paymentTermsDays} jours</p>
        </div>
      </div>

      {quote.introductionText && (
        <p className="mb-4 text-sm whitespace-pre-wrap">{quote.introductionText}</p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Désignation</TableHead>
            {!compact && <TableHead className="text-right">Qté</TableHead>}
            {!compact && <TableHead className="text-right">P.U. HT</TableHead>}
            <TableHead className="text-right">Total HT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totals.lines.map((line, i) => {
            const src = quote.lines[i];
            const isNonBillable = line.lineType === "SECTION" || line.lineType === "COMMENT";
            if (isNonBillable) {
              return (
                <TableRow key={i}>
                  <TableCell colSpan={4} className="bg-slate-50 font-semibold">
                    {src.name}
                    {src.description && (
                      <span className="ml-2 font-normal text-[var(--color-muted-foreground)]">
                        {src.description}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow key={i}>
                <TableCell>
                  <div>{src.name}</div>
                  {src.reference && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">{src.reference}</div>
                  )}
                  {src.description && !compact && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">{src.description}</div>
                  )}
                </TableCell>
                {!compact && (
                  <TableCell className="text-right">
                    {moneyToNumber(src.quantity)} {src.unit}
                  </TableCell>
                )}
                {!compact && (
                  <TableCell className="text-right">
                    {formatCurrency(src.unitPriceExcludingTax, quote.currency)}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {formatCurrency(line.totalExcludingTax, quote.currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs">
          <QuoteTotals
            totals={totals}
            currency={quote.currency}
            shippingAmount={quote.shippingAmountExcludingTax}
            otherFees={quote.otherFeesExcludingTax}
          />
        </div>
      </div>

      {quote.customerNotes && (
        <>
          <Separator className="my-4" />
          <p className="text-sm whitespace-pre-wrap">{quote.customerNotes}</p>
        </>
      )}

      {quote.footerText && (
        <p className="mt-4 text-xs text-[var(--color-muted-foreground)] whitespace-pre-wrap">
          {quote.footerText}
        </p>
      )}
    </div>
  );
}
