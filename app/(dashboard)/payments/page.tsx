import { PaymentsPageClient } from "@/components/payments/payments-page-client";
import { requireAuth } from "@/lib/auth";
import {
  getCustomersForPaymentFilterAction,
  getPaymentStatsAction,
  listPaymentsAction,
} from "@/server/actions/payment.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function PaymentsPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const [list, stats, customers] = await Promise.all([
    listPaymentsAction(params),
    getPaymentStatsAction(),
    getCustomersForPaymentFilterAction(),
  ]);
  return (
    <PaymentsPageClient
      user={user}
      payments={list.payments}
      customers={customers}
      stats={stats}
      total={list.total}
      page={list.page}
      totalPages={list.totalPages}
      filters={params}
    />
  );
}
