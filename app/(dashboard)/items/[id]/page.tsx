import { notFound } from "next/navigation";
import { ItemDetailClient } from "@/components/items/item-detail-client";
import { requireAuth } from "@/lib/auth";
import { getSoldStatsByItemIdsQuery } from "@/lib/item-sales";
import { getItemByIdAction, getItemTagsAction } from "@/server/actions/item.actions";
import { moneyToNumber } from "@/lib/money";

type PageProps = { params: Promise<{ id: string }> };

export default async function ItemDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const [item, allTags] = await Promise.all([getItemByIdAction(id), getItemTagsAction()]);
  if (!item) notFound();

  const soldMap = await getSoldStatsByItemIdsQuery(user.organizationId, [item.id]);
  const sold = soldMap.get(item.id);
  const stockInitial = moneyToNumber(item.stockQuantity);
  const quantitySold = sold?.quantitySold ?? 0;
  const stockSummary = {
    stockInitial,
    quantitySold,
    quantityRemaining: item.isStockable ? Math.max(0, stockInitial - quantitySold) : null,
    revenueExcludingTax: sold?.revenueExcludingTax ?? 0,
    revenueIncludingTax: sold?.revenueIncludingTax ?? 0,
  };

  return (
    <ItemDetailClient user={user} item={item} allTags={allTags} stockSummary={stockSummary} />
  );
}
