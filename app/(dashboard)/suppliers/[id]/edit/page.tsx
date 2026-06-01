import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requireAuth } from "@/lib/auth";
import {
  getSupplierByIdAction,
  getSupplierCategoriesAction,
  getSupplierTagsAction,
} from "@/server/actions/supplier.actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSupplierPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  const [supplier, tags, categories] = await Promise.all([
    getSupplierByIdAction(id),
    getSupplierTagsAction(),
    getSupplierCategoriesAction(),
  ]);

  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Modifier le fournisseur</h1>
        <p className="font-mono text-sm text-[var(--color-muted-foreground)]">
          {supplier.supplierNumber} — {supplier.name}
        </p>
      </div>
      <SupplierForm
        mode="edit"
        supplier={{
          ...supplier,
          tagAssignments: supplier.tagAssignments,
        }}
        supplierId={supplier.id}
        tags={tags}
        categories={categories}
      />
    </div>
  );
}
