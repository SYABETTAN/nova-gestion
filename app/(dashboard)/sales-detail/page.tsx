import { SalesDetailClient } from "@/components/sales/sales-detail-client";
import { requireAuth } from "@/lib/auth";
import { getCustomerOptionByIdQuery } from "@/lib/customers";
import { getItemSelectOptionByIdQuery } from "@/lib/items";
import { listSalesDetailAction } from "@/server/actions/sales-detail.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SalesDetailPage({ searchParams }: PageProps) {
  try {
    const user = await requireAuth();
    const params = await searchParams;
    const [result, initialCustomerOption, initialItemOption] = await Promise.all([
      listSalesDetailAction(params),
      params.customerId
        ? getCustomerOptionByIdQuery(user.organizationId, params.customerId)
        : Promise.resolve(null),
      params.itemId
        ? getItemSelectOptionByIdQuery(user.organizationId, params.itemId)
        : Promise.resolve(null),
    ]);

    return (
      <SalesDetailClient
        result={result}
        filters={params}
        initialCustomerOption={initialCustomerOption ?? null}
        initialItemOption={initialItemOption ?? null}
      />
    );
  } catch {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Impossible de charger le détail des ventes</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Vérifiez vos droits d&apos;accès et la connexion base de données, puis rechargez la page.
        </p>
      </div>
    );
  }
}
