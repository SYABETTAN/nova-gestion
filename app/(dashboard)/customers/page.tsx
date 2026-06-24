import { CustomersSageClient } from "@/components/customers/customers-sage-client";
import { requireAuth } from "@/lib/auth";
import { listCustomersForSageGridAction } from "@/server/actions/customer.actions";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  try {
    const user = await requireAuth();
    const params = await searchParams;
    const grid = await listCustomersForSageGridAction(params);

    return (
      <CustomersSageClient
        user={user}
        rows={grid.rows}
        total={grid.total}
        page={grid.page}
        pageSize={grid.pageSize}
        totalPages={grid.totalPages}
        filters={params}
      />
    );
  } catch {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Impossible de charger les clients</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Vérifiez vos droits d&apos;accès et la connexion base de données, puis rechargez la page.
        </p>
      </div>
    );
  }
}
