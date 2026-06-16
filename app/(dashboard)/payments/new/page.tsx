import { PaymentForm } from "@/components/payments/payment-form";
import { requireAuth } from "@/lib/auth";
import {
  getInvoicePaymentPrefillQuery,
  invoicePaymentPrefillErrorMessage,
} from "@/lib/payment-prefill";
import { getPaymentFormDataWithPrefillQuery } from "@/lib/payments";
import Link from "next/link";

type PageProps = { searchParams: Promise<{ customerId?: string; invoiceId?: string }> };

export default async function NewPaymentPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;

  let prefill: {
    customerId?: string;
    invoiceId?: string;
    amount?: number;
    invoiceNumber?: string;
    customerName?: string;
    totalIncludingTax?: number;
    amountPaid?: number;
    amountDue?: number;
    currency?: string;
    returnInvoiceId?: string;
  } = {};
  let prefillError: string | undefined;

  if (params.invoiceId) {
    const invoicePrefill = await getInvoicePaymentPrefillQuery(
      user.organizationId,
      params.invoiceId,
    );
    if (invoicePrefill.ok) {
      prefill = {
        customerId: invoicePrefill.customerId,
        invoiceId: invoicePrefill.invoiceId,
        amount: invoicePrefill.amount,
        invoiceNumber: invoicePrefill.invoiceNumber,
        customerName: invoicePrefill.customerName,
        totalIncludingTax: invoicePrefill.totalIncludingTax,
        amountPaid: invoicePrefill.amountPaid,
        amountDue: invoicePrefill.amountDue,
        currency: invoicePrefill.currency,
        returnInvoiceId: invoicePrefill.invoiceId,
      };
    } else {
      prefillError = invoicePaymentPrefillErrorMessage(invoicePrefill.error);
    }
  } else if (params.customerId) {
    prefill = { customerId: params.customerId };
  }

  const { customers } = await getPaymentFormDataWithPrefillQuery(
    user.organizationId,
    prefill.customerId,
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Nouveau paiement</h1>
        </div>
        <p className="text-[var(--color-muted-foreground)]">
          Enregistrez un règlement client
        </p>
      </div>

      {prefillError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {prefillError}
          {params.invoiceId && (
            <>
              {" "}
              <Link href={`/invoices/${params.invoiceId}`} className="underline">
                Retour à la facture
              </Link>
            </>
          )}
        </div>
      )}

      <PaymentForm
        mode="create"
        customers={customers}
        prefill={prefillError ? undefined : prefill}
        disabled={Boolean(prefillError)}
      />
    </div>
  );
}
