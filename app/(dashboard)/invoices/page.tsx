import { InvoicesPageClient } from "@/components/invoices/invoices-page-client";
import { requireAuth } from "@/lib/auth";
import { getCustomerOptionByIdQuery } from "@/lib/customers";
import { getInvoiceStatsAction, listInvoicesAction } from "@/server/actions/invoice.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function InvoicesPage({ searchParams }: PageProps) {
  try {
    const user = await requireAuth();
    const params = await searchParams;
    const [list, stats, initialCustomerOption] = await Promise.all([
      listInvoicesAction(params),
      getInvoiceStatsAction(),
      params.customerId
        ? getCustomerOptionByIdQuery(user.organizationId, params.customerId)
        : Promise.resolve(null),
    ]);
    return (
      <InvoicesPageClient
        user={user}
        invoices={list.invoices}
        initialCustomerOption={initialCustomerOption ?? null}
        stats={stats}
        total={list.total}
        page={list.page}
        totalPages={list.totalPages}
        filters={params}
      />
    );
  } catch {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Impossible de charger les factures</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Verifiez vos droits d&apos;acces et la connexion base de donnees, puis rechargez la page.
        </p>
      </div>
    );
  }
}
