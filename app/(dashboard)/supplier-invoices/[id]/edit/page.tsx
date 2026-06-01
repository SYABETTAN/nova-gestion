import Link from "next/link";
import { notFound } from "next/navigation";
import { SupplierInvoiceForm } from "@/components/supplier-invoices/supplier-invoice-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { isSupplierInvoiceEditable } from "@/lib/supplier-invoice-status";
import {
  getSupplierInvoiceByIdAction,
  getSupplierInvoiceFormDataAction,
} from "@/server/actions/supplier-invoice.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditSupplierInvoicePage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  const [invoice, formData] = await Promise.all([
    getSupplierInvoiceByIdAction(id),
    getSupplierInvoiceFormDataAction(),
  ]);
  if (!invoice) notFound();
  if (!isSupplierInvoiceEditable(invoice.status)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Modification impossible</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Cette facture est verrouillée et ne peut plus être modifiée.
        </p>
        <Button asChild variant="outline">
          <Link href={`/supplier-invoices/${id}`}>Retour à la facture</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Modifier {invoice.supplierInvoiceNumber}</h1>
      </div>
      <SupplierInvoiceForm
        mode="edit"
        invoice={invoice}
        suppliers={formData.suppliers}
        expenseCategories={formData.expenseCategories}
      />
    </div>
  );
}
