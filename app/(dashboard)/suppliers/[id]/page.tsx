import { notFound } from "next/navigation";
import { SupplierDetailClient } from "@/components/suppliers/supplier-detail-client";
import { requireAuth } from "@/lib/auth";
import { getSupplierInvoicesBySupplierQuery } from "@/lib/supplier-invoices";
import {
  getSupplierByIdAction,
  getSupplierTagsAction,
} from "@/server/actions/supplier.actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SupplierDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const [supplier, allTags, supplierInvoices] = await Promise.all([
    getSupplierByIdAction(id),
    getSupplierTagsAction(),
    getSupplierInvoicesBySupplierQuery(user.organizationId, id, 20),
  ]);

  if (!supplier) notFound();

  return (
    <SupplierDetailClient
      user={user}
      supplier={supplier}
      allTags={allTags}
      supplierInvoices={supplierInvoices}
    />
  );
}
