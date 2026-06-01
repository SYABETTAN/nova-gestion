"use client";

import { formatCurrency } from "@/lib/pricing";
import {
  groupSupplierInvoiceVatByRate,
  type SupplierInvoiceTotals,
} from "@/lib/supplier-invoice-calculations";

type SupplierInvoiceTotalsProps = {
  totals: SupplierInvoiceTotals;
  currency?: string;
  showPayment?: boolean;
};

export function SupplierInvoiceTotals({
  totals,
  currency = "EUR",
  showPayment = true,
}: SupplierInvoiceTotalsProps) {
  const vatGroups = groupSupplierInvoiceVatByRate(totals.lines);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-[var(--color-muted-foreground)]">Sous-total HT</span>
        <span>{formatCurrency(totals.subtotalExcludingTax, currency)}</span>
      </div>
      {totals.totalDiscountAmount > 0 && (
        <div className="flex justify-between text-amber-700">
          <span>Remises lignes</span>
          <span>- {formatCurrency(totals.totalDiscountAmount, currency)}</span>
        </div>
      )}
      <div className="flex justify-between font-medium">
        <span>Total HT</span>
        <span>{formatCurrency(totals.totalExcludingTax, currency)}</span>
      </div>
      {vatGroups.map((g) => (
        <div key={g.rate} className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">TVA {g.rate} %</span>
          <span>{formatCurrency(g.vat, currency)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t pt-2 text-base font-bold">
        <span>Total TTC</span>
        <span>{formatCurrency(totals.totalIncludingTax, currency)}</span>
      </div>
      {showPayment && (
        <>
          <div className="flex justify-between text-emerald-700">
            <span>Montant payé</span>
            <span>{formatCurrency(totals.amountPaid, currency)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Reste à payer</span>
            <span>{formatCurrency(totals.amountDue, currency)}</span>
          </div>
        </>
      )}
    </div>
  );
}
