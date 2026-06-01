import { notFound } from "next/navigation";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { InvoicePrintActions } from "@/components/invoices/invoice-print-actions";
import { requireAuth } from "@/lib/auth";
import { getInvoiceByIdAction, getInvoiceFormDataAction } from "@/server/actions/invoice.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function InvoicePrintPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  const [invoice, formData] = await Promise.all([
    getInvoiceByIdAction(id),
    getInvoiceFormDataAction(),
  ]);
  if (!invoice) notFound();
  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <div className="mb-6 print:hidden"><InvoicePrintActions /></div>
      <InvoicePreview invoice={invoice} organization={formData.organization} compact />
    </div>
  );
}
