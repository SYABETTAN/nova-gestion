import Link from "next/link";
import { SearchPageClient } from "@/components/search/search-page-client";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  globalSearch,
  loadEnabledModules,
  loadFavoriteKeys,
} from "@/lib/search/search-service";
import { parseSearchEntityType } from "@/lib/search/search-utils";
import type { GlobalSearchResponse } from "@/lib/search/search-types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const user = await requireAuth();
  requirePermission(user, "GLOBAL_SEARCH_USE");
  const params = await searchParams;
  const query = params.q ?? "";
  const entityType = parseSearchEntityType(params.type);

  let initialData: GlobalSearchResponse | null = null;
  let initialError: string | undefined;

  if (query.trim()) {
    try {
      const [enabledModules, favoriteKeys] = await Promise.all([
        loadEnabledModules(user.organizationId),
        loadFavoriteKeys(user.organizationId, user.id),
      ]);
      initialData = await globalSearch(user, query, {
        organizationId: user.organizationId,
        enabledModules,
        favoriteKeys,
        types: entityType ? [entityType] : undefined,
        limitPerGroup: 20,
        globalLimit: 50,
      });
    } catch (error) {
      console.error("[global-search] page_failed", {
        query,
        type: params.type ?? "all",
        organizationId: user.organizationId,
        message: error instanceof Error ? error.message : String(error),
      });
      initialError = "Impossible d'afficher les résultats pour le moment.";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Résultats de recherche</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Recherchez clients, factures, devis et plus.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">← Tableau de bord</Link>
        </Button>
      </div>
      <SearchPageClient
        user={user}
        initialQuery={query}
        initialType={params.type}
        initialData={initialData}
        initialError={initialError}
      />
    </div>
  );
}
