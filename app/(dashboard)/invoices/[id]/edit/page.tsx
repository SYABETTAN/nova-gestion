import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { isInvoiceEditable } from "@/lib/invoice-status";
import { getInvoiceByIdAction, getInvoiceFormDataAction } from "@/server/actions/invoice.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditInvoicePage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  const [invoice, formData] = await Promise.all([
    getInvoiceByIdAction(id),
    getInvoiceFormDataAction(),
  ]);
  if (!invoice) notFound();
  if (!isInvoiceEditable(invoice.status)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Modification impossible</h1>
        <p className="text-[var(--color-muted-foreground)]">Cette facture est verrouillée et ne peut plus être modifiée.</p>
        <Button asChild variant="outline"><Link href={`/invoices/${id}`}>Retour à la facture</Link></Button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Modifier {invoice.invoiceNumber}</h1>
      </div>
      <InvoiceForm mode="edit" invoice={invoice} customers={formData.customers} items={formData.items} organization={formData.organization} />
    </div>
  );
}
