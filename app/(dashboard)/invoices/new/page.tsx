import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { getInvoiceFormDataAction } from "@/server/actions/invoice.actions";

export default async function NewInvoicePage() {
  await requireAuth();
  const { customers, items, organization } = await getInvoiceFormDataAction();
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Nouvelle facture</h1>
        </div>
        <p className="text-[var(--color-muted-foreground)]">Créez une facture commerciale fictive</p>
      </div>
      <InvoiceForm mode="create" customers={customers} items={items} organization={organization} />
    </div>
  );
}
