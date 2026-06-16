import { notFound } from "next/navigation";
import { CustomerDetailClient } from "@/components/customers/customer-detail-client";
import { requireAuth } from "@/lib/auth";
import { getRecentPaymentsByCustomerAction } from "@/server/actions/payment.actions";
import { getCustomerCollectionDataQuery } from "@/lib/reminders";
import {
  getCustomerByIdAction,
  getCustomerFinancialSummaryAction,
  getCustomerTagsAction,
} from "@/server/actions/customer.actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const [customer, allTags, recentPayments, collectionData, financialSummary] = await Promise.all([
    getCustomerByIdAction(id),
    getCustomerTagsAction(),
    getRecentPaymentsByCustomerAction(id),
    getCustomerCollectionDataQuery(user.organizationId, id),
    getCustomerFinancialSummaryAction(id),
  ]);

  if (!customer) notFound();

  return (
    <CustomerDetailClient
      user={user}
      customer={customer}
      allTags={allTags}
      recentPayments={recentPayments}
      collectionData={collectionData}
      financialSummary={financialSummary}
    />
  );
}
