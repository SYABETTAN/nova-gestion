import { SupplierInvoiceForm } from "@/components/supplier-invoices/supplier-invoice-form";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { getSupplierInvoiceFormDataAction } from "@/server/actions/supplier-invoice.actions";

type PageProps = {
  searchParams: Promise<{ supplierId?: string }>;
};

export default async function NewSupplierInvoicePage({ searchParams }: PageProps) {
  await requireAuth();
  const { supplierId } = await searchParams;
  const { suppliers, expenseCategories } = await getSupplierInvoiceFormDataAction();
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Nouvelle facture fournisseur</h1>
        </div>
        <p className="text-[var(--color-muted-foreground)]">
          Enregistrez une facture reçue d{"'"}un fournisseur (données fictives).
        </p>
      </div>
      <SupplierInvoiceForm
        mode="create"
        suppliers={suppliers}
        expenseCategories={expenseCategories}
        prefillSupplierId={supplierId}
      />
    </div>
  );
}
