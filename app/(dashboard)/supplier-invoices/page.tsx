import { SupplierInvoicesPageClient } from "@/components/supplier-invoices/supplier-invoices-page-client";
import { requireAuth } from "@/lib/auth";
import {
  getSupplierInvoiceFormDataAction,
  getSupplierInvoiceStatsAction,
  listSupplierInvoicesAction,
} from "@/server/actions/supplier-invoice.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SupplierInvoicesPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const [list, stats, formData] = await Promise.all([
    listSupplierInvoicesAction(params),
    getSupplierInvoiceStatsAction(),
    getSupplierInvoiceFormDataAction(),
  ]);
  return (
    <SupplierInvoicesPageClient
      user={user}
      invoices={list.invoices}
      suppliers={formData.suppliers}
      expenseCategories={formData.expenseCategories}
      stats={stats}
      total={list.total}
      page={list.page}
      totalPages={list.totalPages}
      filters={params}
    />
  );
}
