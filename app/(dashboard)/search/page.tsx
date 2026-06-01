import Link from "next/link";
import { SearchPageClient } from "@/components/search/search-page-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const user = await requireAuth();
  requirePermission(user, "GLOBAL_SEARCH_USE");
  const params = await searchParams;
  const query = params.q ?? "";
  const type = params.type;

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
      <SearchPageClient user={user} initialQuery={query} initialType={type} />
    </div>
  );
}
