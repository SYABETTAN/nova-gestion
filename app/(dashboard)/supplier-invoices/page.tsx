import { SupplierInvoicesSageClient } from "@/components/supplier-invoices/supplier-invoices-sage-client";
import { requireAuth } from "@/lib/auth";
import {
  getSupplierInvoiceFormDataAction,
  listSupplierInvoicesForSageGridAction,
} from "@/server/actions/supplier-invoice.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SupplierInvoicesPage({ searchParams }: PageProps) {
  try {
    const user = await requireAuth();
    const params = await searchParams;
    const [grid, formData] = await Promise.all([
      listSupplierInvoicesForSageGridAction(params),
      getSupplierInvoiceFormDataAction(),
    ]);

    return (
      <SupplierInvoicesSageClient
        user={user}
        rows={grid.rows}
        total={grid.total}
        page={grid.page}
        pageSize={grid.pageSize}
        totalPages={grid.totalPages}
        suppliers={formData.suppliers.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))}
        filters={params}
      />
    );
  } catch {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Impossible de charger les factures fournisseurs</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Vérifiez vos droits d&apos;accès et la connexion base de données, puis rechargez la page.
        </p>
      </div>
    );
  }
}
