import { notFound } from "next/navigation";
import { SupplierInvoiceDetailClient } from "@/components/supplier-invoices/supplier-invoice-detail-client";
import { requireAuth } from "@/lib/auth";
import { getAccountingEntryBySourceAction } from "@/server/actions/accounting-entry.actions";
import { getSupplierInvoiceByIdAction } from "@/server/actions/supplier-invoice.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierInvoiceDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const [invoice, accountingEntry] = await Promise.all([
    getSupplierInvoiceByIdAction(id),
    getAccountingEntryBySourceAction("SUPPLIER_INVOICE", id),
  ]);
  if (!invoice) notFound();
  return (
    <SupplierInvoiceDetailClient user={user} invoice={invoice} accountingEntry={accountingEntry} />
  );
}
