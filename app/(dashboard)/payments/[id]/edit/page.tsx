import { notFound } from "next/navigation";
import { PaymentForm } from "@/components/payments/payment-form";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { getPaymentByIdAction, getPaymentFormDataAction } from "@/server/actions/payment.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPaymentPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  const [payment, formData] = await Promise.all([
    getPaymentByIdAction(id),
    getPaymentFormDataAction(),
  ]);
  if (!payment) notFound();
  if (payment.status === "CANCELLED") notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Modifier le paiement</h1>
        </div>
        <p className="font-mono text-[var(--color-muted-foreground)]">{payment.paymentNumber}</p>
      </div>
      <PaymentForm mode="edit" customers={formData.customers} payment={payment} />
    </div>
  );
}
