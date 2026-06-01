import { ItemsPageClient } from "@/components/items/items-page-client";
import { requireAuth } from "@/lib/auth";
import { getItemCategoriesAction, getItemStatsAction, getItemTagsAction, listItemsAction } from "@/server/actions/item.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ItemsPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const [list, stats, categories, tags] = await Promise.all([
    listItemsAction(params),
    getItemStatsAction(),
    getItemCategoriesAction(),
    getItemTagsAction(),
  ]);
  return <ItemsPageClient user={user} items={list.items} categories={categories} tags={tags} stats={stats} total={list.total} page={list.page} totalPages={list.totalPages} filters={params} />;
}
