import { InvoicesPageClient } from "@/components/invoices/invoices-page-client";
import { requireAuth } from "@/lib/auth";
import { getCustomersForInvoiceFilterAction, getInvoiceStatsAction, listInvoicesAction } from "@/server/actions/invoice.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function InvoicesPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const [list, stats, customers] = await Promise.all([
    listInvoicesAction(params),
    getInvoiceStatsAction(),
    getCustomersForInvoiceFilterAction(),
  ]);
  return (
    <InvoicesPageClient
      user={user}
      invoices={list.invoices}
      customers={customers}
      stats={stats}
      total={list.total}
      page={list.page}
      totalPages={list.totalPages}
      filters={params}
    />
  );
}
