import { PaymentForm } from "@/components/payments/payment-form";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { moneyToNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getPaymentFormDataAction } from "@/server/actions/payment.actions";

type PageProps = { searchParams: Promise<{ customerId?: string; invoiceId?: string }> };

export default async function NewPaymentPage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const { customers } = await getPaymentFormDataAction();

  let prefill: { customerId?: string; invoiceId?: string; amount?: number } = {};
  if (params.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.invoiceId },
      select: { id: true, customerId: true, amountDue: true },
    });
    if (invoice) {
      prefill = {
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        amount: moneyToNumber(invoice.amountDue),
      };
    }
  } else if (params.customerId) {
    prefill = { customerId: params.customerId };
  }

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
      <PaymentForm mode="create" customers={customers} prefill={prefill} />
    </div>
  );
}
