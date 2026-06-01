import { notFound } from "next/navigation";
import { PaymentDetailClient } from "@/components/payments/payment-detail-client";
import { requireAuth } from "@/lib/auth";
import { getAccountingEntryBySourceAction } from "@/server/actions/accounting-entry.actions";
import { getPaymentByIdAction } from "@/server/actions/payment.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function PaymentDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const [payment, accountingEntry] = await Promise.all([
    getPaymentByIdAction(id),
    getAccountingEntryBySourceAction("CUSTOMER_PAYMENT", id),
  ]);
  if (!payment) notFound();
  return <PaymentDetailClient user={user} payment={payment} accountingEntry={accountingEntry} />;
}
