import { notFound } from "next/navigation";
import { PaymentReceiptView } from "@/components/payments/payment-receipt-view";
import { PrintButton } from "@/components/payments/payment-print-button";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentByIdAction } from "@/server/actions/payment.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function PaymentReceiptPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const payment = await getPaymentByIdAction(id);
  if (!payment || payment.status === "CANCELLED") notFound();

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!organization) notFound();

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <PrintButton />
      <PaymentReceiptView organization={organization} payment={payment} />
    </div>
  );
}
