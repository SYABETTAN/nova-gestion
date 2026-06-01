"use client";

import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SearchTypeIcon } from "@/components/search/search-icons";
import type { SearchResult } from "@/lib/search/search-types";

export function SearchResultItem({
  result,
  active,
  onSelect,
  onToggleFavorite,
  showFavorite,
}: {
  result: SearchResult;
  active?: boolean;
  onSelect: () => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  showFavorite?: boolean;
}) {
  const icon = (result.metadata?.icon as string) ?? undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
        active ? "bg-blue-50 text-blue-900" : "hover:bg-slate-100",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <SearchTypeIcon icon={icon} type={result.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{result.title}</span>
          {result.badge ? (
            <Badge variant={result.badgeVariant ?? "secondary"} className="shrink-0">
              {result.badge}
            </Badge>
          ) : null}
        </div>
        {result.subtitle ? (
          <p className="truncate text-xs text-[var(--color-muted-foreground)]">{result.subtitle}</p>
        ) : null}
      </div>
      {showFavorite && result.type !== "ACTION" && onToggleFavorite ? (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(e);
          }}
          className="shrink-0 rounded p-1 hover:bg-slate-200"
        >
          <Star
            className={cn("h-4 w-4", result.isFavorite ? "fill-amber-400 text-amber-500" : "text-slate-400")}
          />
        </span>
      ) : null}
    </button>
  );
}
