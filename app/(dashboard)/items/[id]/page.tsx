import { notFound } from "next/navigation";
import { ItemDetailClient } from "@/components/items/item-detail-client";
import { requireAuth } from "@/lib/auth";
import { getItemByIdAction, getItemTagsAction } from "@/server/actions/item.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function ItemDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const [item, allTags] = await Promise.all([getItemByIdAction(id), getItemTagsAction()]);
  if (!item) notFound();
  return <ItemDetailClient user={user} item={item} allTags={allTags} />;
}
