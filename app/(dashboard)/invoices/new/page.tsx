import { InvoiceForm } from "@/components/invoices/invoice-form";
import { requireAuth } from "@/lib/auth";
import { getInvoiceFormDataAction } from "@/server/actions/invoice.actions";

type PageProps = { searchParams: Promise<{ customerId?: string }> };

export default async function NewInvoicePage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const { customers, items, organization } = await getInvoiceFormDataAction();
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Nouvelle facture</h1>
        </div>
        <p className="text-[var(--color-muted-foreground)]">Créez une facture commerciale</p>
      </div>
      <InvoiceForm
        mode="create"
        customers={customers}
        items={items}
        organization={organization}
        initialCustomerId={params.customerId}
      />
    </div>
  );
}
