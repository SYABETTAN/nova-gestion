import { InvoiceSageForm } from "@/components/invoices/invoice-sage-form";
import { requireAuth } from "@/lib/auth";
import { getInvoiceFormDataAction } from "@/server/actions/invoice.actions";

type PageProps = { searchParams: Promise<{ customerId?: string }> };

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const { customers, organization } = await getInvoiceFormDataAction();
  return (
    <InvoiceSageForm
      mode="create"
      user={user}
      customers={customers}
      organization={organization}
      initialCustomerId={params.customerId}
    />
  );
}
