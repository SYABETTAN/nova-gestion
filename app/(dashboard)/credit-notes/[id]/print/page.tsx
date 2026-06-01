import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentPrintLayout } from "@/components/documents/document-print-layout";
import { PrintButton } from "@/components/documents/print-button";
import { requireAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getCreditNoteByIdAction } from "@/server/actions/credit-note.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function CreditNotePrintPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const creditNote = await getCreditNoteByIdAction(id);
  if (!creditNote) notFound();

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!organization) notFound();

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <PrintButton />
      <DocumentPrintLayout
        organization={organization}
        title="Avoir client"
        documentNumber={creditNote.creditNoteNumber}
      >
        <div className="space-y-4 text-sm">
          <p>
            <strong>Client :</strong> {creditNote.customer.name}
          </p>
          <p>
            <strong>Facture liée :</strong> {creditNote.invoice.invoiceNumber}
          </p>
          <p>
            <strong>Date :</strong> {formatDateShort(creditNote.issueDate)}
          </p>
          <p>
            <strong>Motif :</strong> {creditNote.reason}
          </p>
          <div className="space-y-2">
            {creditNote.lines.map((line) => (
              <div key={line.id} className="flex justify-between border-b py-2">
                <span>{line.name}</span>
                <span>{formatCurrency(line.totalIncludingTax)}</span>
              </div>
            ))}
          </div>
          <p className="text-right text-lg font-bold">
            Total TTC : {formatCurrency(creditNote.totalIncludingTax)}
          </p>
          <p>
            <Link href={`/credit-notes/${creditNote.id}`} className="print:hidden text-blue-600">
              Retour à l&apos;avoir
            </Link>
          </p>
        </div>
      </DocumentPrintLayout>
    </div>
  );
}
