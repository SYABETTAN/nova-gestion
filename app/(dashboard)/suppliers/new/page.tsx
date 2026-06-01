import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requireAuth } from "@/lib/auth";
import { getSupplierCategoriesAction, getSupplierTagsAction } from "@/server/actions/supplier.actions";

export default async function NewSupplierPage() {
  await requireAuth();
  const [tags, categories] = await Promise.all([
    getSupplierTagsAction(),
    getSupplierCategoriesAction(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nouveau fournisseur</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Ajoutez un fournisseur à votre répertoire
        </p>
      </div>
      <SupplierForm mode="create" tags={tags} categories={categories} />
    </div>
  );
}
