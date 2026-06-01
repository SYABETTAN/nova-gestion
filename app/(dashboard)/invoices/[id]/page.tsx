import { notFound } from "next/navigation";
import { InvoiceDetailClient } from "@/components/invoices/invoice-detail-client";
import { requireAuth } from "@/lib/auth";
import { getPaymentsByInvoiceQuery } from "@/lib/payments";
import { getReminderNotesByInvoiceQuery, getRemindersByInvoiceQuery } from "@/lib/reminders";
import { getAccountingEntryBySourceAction } from "@/server/actions/accounting-entry.actions";
import { getInvoiceByIdAction, getInvoiceFormDataAction } from "@/server/actions/invoice.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function InvoiceDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const [invoice, formData, paymentAllocations, invoiceReminders, reminderNotes, accountingEntry] = await Promise.all([
    getInvoiceByIdAction(id),
    getInvoiceFormDataAction(),
    getPaymentsByInvoiceQuery(user.organizationId, id),
    getRemindersByInvoiceQuery(user.organizationId, id),
    getReminderNotesByInvoiceQuery(user.organizationId, id),
    getAccountingEntryBySourceAction("CUSTOMER_INVOICE", id),
  ]);
  if (!invoice) notFound();
  return (
    <InvoiceDetailClient
      user={user}
      invoice={invoice}
      organization={formData.organization}
      paymentAllocations={paymentAllocations}
      invoiceReminders={invoiceReminders}
      reminderNotes={reminderNotes}
      accountingEntry={accountingEntry}
    />
  );
}
