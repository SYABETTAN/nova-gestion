import { Badge } from "@/components/ui/badge";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-status";
import { formatCurrency } from "@/lib/pricing";
import { isPositive } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import type { MoneyInput } from "@/lib/money";
import { organizationNameForDocuments } from "@/lib/organization-display";

type ReceiptProps = {
  organization: {
    name: string;
    legalName: string;
    slug?: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
    siret: string | null;
    vatNumber: string | null;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
  };
  payment: {
    paymentNumber: string;
    paymentDate: Date;
    method: string;
    amount: MoneyInput;
    allocatedAmount: MoneyInput;
    unallocatedAmount: MoneyInput;
    currency: string;
    reference: string | null;
    notes: string | null;
    customer: { name: string; email: string | null };
    allocations: {
      amount: MoneyInput;
      invoice: { invoiceNumber: string; totalIncludingTax: MoneyInput };
    }[];
  };
};

export function PaymentReceiptView({ organization, payment }: ReceiptProps) {
  const brandingName = organizationNameForDocuments(organization);

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 print:p-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          {organization.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={organization.logoUrl} alt={brandingName} className="mb-4 h-12" />
          )}
          <h1 className="text-xl font-bold">{brandingName}</h1>
          <p className="text-sm text-slate-600">
            {organization.addressLine1}
            {organization.postalCode && `, ${organization.postalCode} ${organization.city}`}
          </p>
          {organization.siret && <p className="text-xs text-slate-500">SIRET {organization.siret}</p>}
        </div>
      </div>

      <h2 className="mb-6 text-2xl font-bold">Reçu de paiement</h2>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium text-slate-500">Client</p>
          <p>{payment.customer.name}</p>
          {payment.customer.email && <p className="text-slate-600">{payment.customer.email}</p>}
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-500">N° paiement</p>
          <p className="font-mono">{payment.paymentNumber}</p>
          <p className="mt-2 font-medium text-slate-500">Date</p>
          <p>{formatDateShort(payment.paymentDate)}</p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border p-4">
        <div className="flex justify-between text-lg font-bold">
          <span>Montant reçu</span>
          <span>{formatCurrency(payment.amount, payment.currency)}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Mode : {PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.method}
        </p>
        {payment.reference && <p className="text-sm text-slate-600">Réf. : {payment.reference}</p>}
      </div>

      {payment.allocations.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 font-semibold">Factures réglées</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2">Facture</th>
                <th className="pb-2 text-right">Total</th>
                <th className="pb-2 text-right">Alloué</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((a, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 font-mono">{a.invoice.invoiceNumber}</td>
                  <td className="py-2 text-right">{formatCurrency(a.invoice.totalIncludingTax, payment.currency)}</td>
                  <td className="py-2 text-right">{formatCurrency(a.amount, payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isPositive(payment.unallocatedAmount) && (
        <p className="mb-4 text-sm text-amber-700">
          Montant non alloué : {formatCurrency(payment.unallocatedAmount, payment.currency)}
        </p>
      )}

      {payment.notes && (
        <p className="text-sm text-slate-600">{payment.notes}</p>
      )}

      <p className="mt-8 text-center text-xs text-slate-400">
        Reçu de paiement
      </p>
    </div>
  );
}
