import { ItemsPageClient } from "@/components/items/items-page-client";
import { requireAuth } from "@/lib/auth";
import {
  getItemSalesReportAction,
  getItemStatsAction,
  getItemStockSummariesAction,
  getItemCategoriesAction,
  getItemTagsAction,
  listItemsAction,
} from "@/server/actions/item.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ItemsPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const tab = params.tab ?? "catalog";

  const [list, stats, categories, tags] = await Promise.all([
    tab === "catalog" ? listItemsAction(params) : Promise.resolve({ items: [], total: 0, page: 1, totalPages: 1 }),
    getItemStatsAction(),
    getItemCategoriesAction(),
    getItemTagsAction(),
  ]);

  const stockSummaries =
    tab === "catalog" && list.items.length > 0
      ? await getItemStockSummariesAction(list.items.map((item) => item.id))
      : new Map();

  const salesReport = tab === "sales" ? await getItemSalesReportAction(params) : null;

  return (
    <ItemsPageClient
      user={user}
      items={list.items}
      stockSummaries={Object.fromEntries(stockSummaries)}
      categories={categories}
      tags={tags}
      stats={stats}
      total={list.total}
      page={list.page}
      totalPages={list.totalPages}
      filters={params}
      activeTab={tab}
      salesReport={salesReport}
    />
  );
}
