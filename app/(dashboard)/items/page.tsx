import { ItemsSageClient } from "@/components/items/items-sage-client";
import { requireAuth } from "@/lib/auth";
import {
  getItemCategoriesAction,
  listItemsForSageGridAction,
} from "@/server/actions/item.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ItemsPage({ searchParams }: PageProps) {
  try {
    const user = await requireAuth();
    const params = await searchParams;
    const [grid, categories] = await Promise.all([
      listItemsForSageGridAction(params),
      getItemCategoriesAction(),
    ]);

    return (
      <ItemsSageClient
        user={user}
        rows={grid.rows}
        total={grid.total}
        page={grid.page}
        pageSize={grid.pageSize}
        totalPages={grid.totalPages}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        filters={params}
      />
    );
  } catch {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Impossible de charger les articles</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Vérifiez vos droits d&apos;accès et la connexion base de données, puis rechargez la page.
        </p>
      </div>
    );
  }
}
