"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchResultItem } from "@/components/search/search-result-item";
import { useDebouncedValue } from "@/hooks/use-debounced-search";
import type { SessionUser } from "@/lib/permissions";
import type { GlobalSearchResponse, SearchResult } from "@/lib/search/search-types";
import { findExactMatch } from "@/lib/search/search-utils";
import {
  clearRecentSearchesAction,
  globalSearchAction,
  getSearchInitialStateAction,
  openGlobalSearchAction,
  recordSearchAction,
  recordSearchClickAction,
  toggleFavoriteEntityAction,
} from "@/server/actions/search.actions";

type FlatItem = { groupLabel: string; result: SearchResult };

export function GlobalCommandPalette({
  open,
  onOpenChange,
  user: _user,
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
  initialQuery?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query, 200);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalSearchResponse | null>(null);
  const [recent, setRecent] = useState<{ query: string }[]>([]);
  const [favoriteHrefs, setFavoriteHrefs] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<
    { entityType: string; entityId: string; title: string; subtitle: string | null; href: string }[]
  >([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadInitial = useCallback(async () => {
    const state = await getSearchInitialStateAction();
    setRecent(state.recent.map((r) => ({ query: r.query })));
    setFavorites(state.favorites);
    setFavoriteHrefs(new Set(state.favorites.map((f) => `${f.entityType}:${f.entityId}`)));
  }, []);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setActiveIndex(0);
      void loadInitial();
      void openGlobalSearchAction();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialQuery, loadInitial]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const result = await globalSearchAction({ query: debouncedQuery });
        if (!cancelled) setData(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const flatItems: FlatItem[] = useMemo(() => {
    if (!data?.groups.length) return [];
    return data.groups.flatMap((g) =>
      g.results.map((result) => ({ groupLabel: g.label, result })),
    );
  }, [data]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, flatItems.length]);

  async function navigateTo(result: SearchResult) {
    if (debouncedQuery.trim().length >= 2) {
      await recordSearchAction({ query: debouncedQuery.trim() });
      await recordSearchClickAction({
        query: debouncedQuery.trim(),
        resultType: result.type,
        resultId: result.id,
        resultTitle: result.title,
      });
    }
    onOpenChange(false);
    router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const flat = flatItems.map((f) => f.result);
      const exact = debouncedQuery ? findExactMatch(flat, debouncedQuery) : undefined;
      const target = exact ?? flatItems[activeIndex]?.result;
      if (target) void navigateTo(target);
    }
  }

  async function runRecentSearch(q: string) {
    setQuery(q);
    inputRef.current?.focus();
  }

  async function handleClearRecent() {
    await clearRecentSearchesAction();
    setRecent([]);
    toast.success("Recherches récentes effacées");
  }

  async function handleToggleFavorite(result: SearchResult) {
    const key = `${result.type}:${result.id}`;
    await toggleFavoriteEntityAction({
      entityType: result.type,
      entityId: result.id,
      title: result.title,
      subtitle: result.subtitle,
      href: result.href,
    });
    setFavoriteHrefs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    const result2 = await globalSearchAction({ query: debouncedQuery });
    setData(result2);
  }

  const resultsWithFavorites = flatItems.map(({ groupLabel, result }) => ({
    groupLabel,
    result: {
      ...result,
      isFavorite: favoriteHrefs.has(`${result.type}:${result.id}`),
    },
  }));

  let lastGroup = "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-slate-500" />
            <DialogTitle className="text-base">Recherche globale</DialogTitle>
          </div>
          <DialogDescription className="text-left text-xs">
            Recherchez clients, factures, devis et plus.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b px-4 py-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un client, une facture, un devis…"
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
          {!debouncedQuery && favorites.length > 0 ? (
            <div className="mb-3 px-2">
              <p className="mb-1 text-xs font-medium text-slate-500">Favoris</p>
              {favorites.map((f) => (
                <SearchResultItem
                  key={`${f.entityType}-${f.entityId}`}
                  result={{
                    id: f.entityId,
                    type: f.entityType as SearchResult["type"],
                    title: f.title,
                    subtitle: f.subtitle ?? undefined,
                    href: f.href,
                    score: 0,
                    isFavorite: true,
                  }}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(f.href);
                  }}
                  showFavorite
                  onToggleFavorite={() =>
                    void toggleFavoriteEntityAction({
                      entityType: f.entityType,
                      entityId: f.entityId,
                      title: f.title,
                      subtitle: f.subtitle ?? undefined,
                      href: f.href,
                    }).then(() => loadInitial())
                  }
                />
              ))}
            </div>
          ) : null}

          {!debouncedQuery && recent.length > 0 ? (
            <div className="mb-3 px-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Recherches récentes</p>
                <button
                  type="button"
                  onClick={() => void handleClearRecent()}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  <Trash2 className="h-3 w-3" />
                  Effacer
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r.query}
                    type="button"
                    onClick={() => void runRecentSearch(r.query)}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs hover:bg-slate-200"
                  >
                    <Clock className="h-3 w-3" />
                    {r.query}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Recherche en cours…</p>
          ) : resultsWithFavorites.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              {debouncedQuery ? "Aucun résultat trouvé." : "Tapez pour rechercher ou choisissez une action."}
            </p>
          ) : (
            resultsWithFavorites.map(({ groupLabel, result }, index) => {
              const showHeader = groupLabel !== lastGroup;
              lastGroup = groupLabel;
              return (
                <div key={`${result.type}-${result.id}-${index}`}>
                  {showHeader ? (
                    <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {groupLabel}
                    </p>
                  ) : null}
                  <SearchResultItem
                    result={result}
                    active={index === activeIndex}
                    onSelect={() => void navigateTo(result)}
                    showFavorite
                    onToggleFavorite={() => void handleToggleFavorite(result)}
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span>↑↓ naviguer · Entrée ouvrir · Échap fermer</span>
          {debouncedQuery ? (
            <Link
              href={`/search?q=${encodeURIComponent(debouncedQuery)}`}
              onClick={() => onOpenChange(false)}
              className="text-blue-600 hover:underline"
            >
              Voir tous les résultats
            </Link>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
