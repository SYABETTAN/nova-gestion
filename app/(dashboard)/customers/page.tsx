import { CustomersPageClient } from "@/components/customers/customers-page-client";
import { requireAuth } from "@/lib/auth";
import {
  getCustomerStatsAction,
  getCustomerTagsAction,
  listCustomersAction,
} from "@/server/actions/customer.actions";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;

  const [listResult, stats, tags] = await Promise.all([
    listCustomersAction(params),
    getCustomerStatsAction(),
    getCustomerTagsAction(),
  ]);

  return (
    <CustomersPageClient
      user={user}
      customers={listResult.customers}
      tags={tags}
      stats={stats}
      total={listResult.total}
      page={listResult.page}
      totalPages={listResult.totalPages}
      filters={params}
    />
  );
}
