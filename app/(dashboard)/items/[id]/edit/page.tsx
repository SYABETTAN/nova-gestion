import { notFound } from "next/navigation";
import { ItemForm } from "@/components/items/item-form";
import { getItemByIdAction, getItemCategoriesAction, getItemSuppliersAction, getItemTagsAction, getItemUnitsAction } from "@/server/actions/item.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditItemPage({ params }: PageProps) {
  const { id } = await params;
  const [item, categories, units, tags, suppliers] = await Promise.all([
    getItemByIdAction(id),
    getItemCategoriesAction(),
    getItemUnitsAction(),
    getItemTagsAction(),
    getItemSuppliersAction(),
  ]);
  if (!item) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Modifier l&apos;article / service</h1>
        <p className="text-[var(--color-muted-foreground)]">{item.itemNumber} — {item.name}</p>
      </div>
      <ItemForm mode="edit" itemId={item.id} item={{ ...item, tagAssignments: item.tagAssignments.map((a) => ({ tagId: a.tagId })) }} categories={categories} units={units} tags={tags} suppliers={suppliers} />
    </div>
  );
}
