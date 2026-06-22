import { InvoicesSageClient } from "@/components/invoices/invoices-sage-client";
import { requireAuth } from "@/lib/auth";
import { getCustomerOptionByIdQuery } from "@/lib/customers";
import { listInvoicesForSageGridAction } from "@/server/actions/invoice.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function InvoicesPage({ searchParams }: PageProps) {
  try {
    const user = await requireAuth();
    const params = await searchParams;
    const [grid, initialCustomerOption] = await Promise.all([
      listInvoicesForSageGridAction(params),
      params.customerId
        ? getCustomerOptionByIdQuery(user.organizationId, params.customerId)
        : Promise.resolve(null),
    ]);
    return (
      <InvoicesSageClient
        user={user}
        invoices={grid.invoices}
        total={grid.total}
        page={grid.page}
        pageSize={grid.pageSize}
        totalPages={grid.totalPages}
        totals={grid.totals}
        exercise={grid.exercise}
        initialCustomerOption={initialCustomerOption ?? null}
        filters={params}
      />
    );
  } catch {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Impossible de charger les factures</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Vérifiez vos droits d&apos;accès et la connexion base de données, puis rechargez la page.
        </p>
      </div>
    );
  }
}
