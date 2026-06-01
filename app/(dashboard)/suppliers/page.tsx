import { SuppliersPageClient } from "@/components/suppliers/suppliers-page-client";
import { requireAuth } from "@/lib/auth";
import {
  getSupplierCategoriesAction,
  getSupplierStatsAction,
  getSupplierTagsAction,
  listSuppliersAction,
} from "@/server/actions/supplier.actions";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function SuppliersPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;

  const [listResult, stats, tags, categories] = await Promise.all([
    listSuppliersAction(params),
    getSupplierStatsAction(),
    getSupplierTagsAction(),
    getSupplierCategoriesAction(),
  ]);

  return (
    <SuppliersPageClient
      user={user}
      suppliers={listResult.suppliers}
      tags={tags}
      categories={categories}
      stats={stats}
      total={listResult.total}
      page={listResult.page}
      totalPages={listResult.totalPages}
      filters={params}
    />
  );
}
