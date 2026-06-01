import { notFound } from "next/navigation";
import { DocumentPrintLayout } from "@/components/documents/document-print-layout";
import { PrintButton } from "@/components/documents/print-button";
import { requireAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getReminderByIdAction } from "@/server/actions/reminder.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function ReminderPrintPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const reminder = await getReminderByIdAction(id);
  if (!reminder) notFound();

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!organization) notFound();

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <PrintButton />
      <DocumentPrintLayout
        organization={organization}
        title="Relance client"
        documentNumber={reminder.reminderNumber}
        documentType={`Niveau ${reminder.level}`}
      >
        <div className="space-y-4 text-sm leading-relaxed">
          <p>Objet : {reminder.subject}</p>
          <div className="whitespace-pre-wrap rounded border bg-slate-50 p-4">
            {reminder.message}
          </div>
          <p>
            Facture : {reminder.invoice.invoiceNumber} — Montant dû :{" "}
            {formatCurrency(reminder.invoiceAmountDue)}
          </p>
          <p>Retard : {reminder.daysOverdue} jours</p>
        </div>
      </DocumentPrintLayout>
    </div>
  );
}
