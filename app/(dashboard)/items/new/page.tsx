import { ItemForm } from "@/components/items/item-form";
import { getItemCategoriesAction, getItemTagsAction, getItemUnitsAction } from "@/server/actions/item.actions";

export default async function NewItemPage() {
  const [categories, units, tags] = await Promise.all([
    getItemCategoriesAction(),
    getItemUnitsAction(),
    getItemTagsAction(),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nouvel article / service</h1>
        <p className="text-[var(--color-muted-foreground)]">Ajoutez un élément au catalogue</p>
      </div>
      <ItemForm mode="create" categories={categories} units={units} tags={tags} />
    </div>
  );
}
