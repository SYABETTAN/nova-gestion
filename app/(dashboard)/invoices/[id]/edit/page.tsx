import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceSageForm } from "@/components/invoices/invoice-sage-form";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { isInvoiceEditable } from "@/lib/invoice-status";
import { getInvoiceByIdAction, getInvoiceFormDataAction } from "@/server/actions/invoice.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditInvoicePage({ params }: PageProps) {
  const user = await requireAuth();
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
        <p className="text-[var(--color-muted-foreground)]">
          Cette facture est verrouillée et ne peut plus être modifiée.
        </p>
        <Button asChild variant="outline">
          <Link href={`/invoices/${id}`}>Retour à la facture</Link>
        </Button>
      </div>
    );
  }
  return (
    <InvoiceSageForm
      mode="edit"
      user={user}
      invoice={invoice}
      customers={formData.customers}
      organization={formData.organization}
    />
  );
}
