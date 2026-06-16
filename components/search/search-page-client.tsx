"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchResultItem } from "@/components/search/search-result-item";
import { SEARCH_GROUP_LABELS } from "@/lib/search/search-registry";
import type { SessionUser } from "@/lib/permissions";
import type { GlobalSearchResponse } from "@/lib/search/search-types";
import { parseSearchEntityType } from "@/lib/search/search-utils";
import { globalSearchAction, toggleFavoriteEntityAction } from "@/server/actions/search.actions";

const FILTER_TYPES = Object.keys(SEARCH_GROUP_LABELS).filter((t) => t !== "ACTION");

export function SearchPageClient({
  user: _user,
  initialQuery,
  initialType,
  initialData,
  initialError,
}: {
  user: SessionUser;
  initialQuery: string;
  initialType?: string;
  initialData?: GlobalSearchResponse | null;
  initialError?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState(initialType ?? "all");
  const [data, setData] = useState<GlobalSearchResponse | null>(initialData ?? null);
  const [error, setError] = useState<string | undefined>(initialError);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!query.trim()) {
        setData(null);
        setError(undefined);
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        const parsedType = parseSearchEntityType(typeFilter);
        const result = await globalSearchAction({
          query,
          limit: 50,
          types: parsedType ? [parsedType] : undefined,
        });
        if (!cancelled) {
          setData(result);
          if (result.error) setError(result.error);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setError("La recherche est temporairement indisponible.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [query, typeFilter]);

  const groups = data?.groups ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[240px] flex-1 space-y-1">
          <Label>Recherche</Label>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              const params = new URLSearchParams();
              if (e.target.value) params.set("q", e.target.value);
              if (typeFilter !== "all") params.set("type", typeFilter);
              router.replace(`/search?${params.toString()}`);
            }}
            placeholder="Mot-clé, numéro, nom…"
          />
        </div>
        <div className="w-48 space-y-1">
          <Label>Type</Label>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v);
              const params = new URLSearchParams();
              if (query) params.set("q", query);
              if (v !== "all") params.set("type", v);
              router.replace(`/search?${params.toString()}`);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {FILTER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {SEARCH_GROUP_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Recherche en cours…</p>
      ) : !query.trim() ? (
        <p className="text-sm text-slate-500">Saisissez un mot-clé pour lancer la recherche.</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun résultat trouvé.</p>
      ) : (
        groups.map((group) => (
          <section key={group.type} className="rounded-lg border bg-white p-4">
            <h2 className="mb-2 font-semibold">{group.label}</h2>
            <div className="divide-y">
              {group.results.map((result) => (
                <SearchResultItem
                  key={`${result.type}-${result.id}`}
                  result={result}
                  onSelect={() => router.push(result.href)}
                  showFavorite
                  onToggleFavorite={() =>
                    void toggleFavoriteEntityAction({
                      entityType: result.type,
                      entityId: result.id,
                      title: result.title,
                      subtitle: result.subtitle,
                      href: result.href,
                    })
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}

      {query.trim() && data && !error ? (
        <p className="text-xs text-slate-500">
          {data.totalCount} résultat(s) · Utilisez{" "}
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ⌘K
          </Link>{" "}
          pour une recherche rapide.
        </p>
      ) : null}
    </div>
  );
}
