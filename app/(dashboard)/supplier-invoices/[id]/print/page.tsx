import { notFound } from "next/navigation";
import { DocumentPrintLayout } from "@/components/documents/document-print-layout";
import { PrintButton } from "@/components/documents/print-button";
import { requireAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getSupplierInvoiceByIdAction } from "@/server/actions/supplier-invoice.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierInvoicePrintPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const invoice = await getSupplierInvoiceByIdAction(id);
  if (!invoice) notFound();

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!organization) notFound();

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <PrintButton />
      <DocumentPrintLayout
        organization={organization}
        title="Facture fournisseur"
        documentNumber={invoice.supplierInvoiceNumber}
        documentType="Facture fournisseur"
      >
        <div className="space-y-4 text-sm">
          <p>
            <strong>Fournisseur :</strong> {invoice.supplier.name}
          </p>
          <p>
            <strong>Date :</strong> {formatDateShort(invoice.issueDate)} — Échéance :{" "}
            {formatDateShort(invoice.dueDate)}
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Désignation</th>
                <th className="py-2 text-right">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="py-2">{line.name}</td>
                  <td className="py-2 text-right">
                    {formatCurrency(line.totalExcludingTax, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-right text-lg font-bold">
            Total TTC : {formatCurrency(invoice.totalIncludingTax, invoice.currency)}
          </p>
        </div>
      </DocumentPrintLayout>
    </div>
  );
}
