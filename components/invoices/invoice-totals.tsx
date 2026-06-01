"use client";

import { formatCurrency } from "@/lib/pricing";
import { isPositive, type MoneyInput } from "@/lib/money";
import type { CalculatedInvoiceTotals } from "@/lib/invoice-calculations";
import { groupVatByRate } from "@/lib/invoice-calculations";

type InvoiceTotalsProps = {
  totals: CalculatedInvoiceTotals;
  currency?: string;
  shippingAmount?: MoneyInput;
  otherFees?: MoneyInput;
  showPayment?: boolean;
};

export function InvoiceTotals({
  totals,
  currency = "EUR",
  shippingAmount = 0,
  otherFees = 0,
  showPayment = true,
}: InvoiceTotalsProps) {
  const vatGroups = groupVatByRate(totals.lines);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-[var(--color-muted-foreground)]">Sous-total HT</span>
        <span>{formatCurrency(totals.subtotalExcludingTax, currency)}</span>
      </div>
      {totals.lineDiscountAmount > 0 && (
        <div className="flex justify-between text-amber-700">
          <span>Remises lignes</span>
          <span>- {formatCurrency(totals.lineDiscountAmount, currency)}</span>
        </div>
      )}
      {totals.globalDiscountAmount > 0 && (
        <div className="flex justify-between text-amber-700">
          <span>Remise globale</span>
          <span>- {formatCurrency(totals.globalDiscountAmount, currency)}</span>
        </div>
      )}
      {isPositive(shippingAmount) && (
        <div className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">Frais de livraison HT</span>
          <span>{formatCurrency(shippingAmount, currency)}</span>
        </div>
      )}
      {isPositive(otherFees) && (
        <div className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">Autres frais HT</span>
          <span>{formatCurrency(otherFees, currency)}</span>
        </div>
      )}
      <div className="flex justify-between font-medium">
        <span>Total HT</span>
        <span>{formatCurrency(totals.totalExcludingTax, currency)}</span>
      </div>
      {vatGroups.map((g) => (
        <div key={g.vatRate} className="flex justify-between">
          <span className="text-[var(--color-muted-foreground)]">TVA {g.vatRate} %</span>
          <span>{formatCurrency(g.vatAmount, currency)}</span>
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
