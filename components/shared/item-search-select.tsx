"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-search";
import { searchItemsForSelectAction } from "@/server/actions/item.actions";
import type { ItemSelectOption } from "@/lib/items";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onValueChange: (itemId: string) => void;
  initialOption?: ItemSelectOption | null;
  disabled?: boolean;
  label?: string;
};

function itemLabel(i: ItemSelectOption): string {
  return [i.itemNumber, i.name].filter(Boolean).join(" · ");
}

export function ItemSearchSelect({
  value,
  onValueChange,
  initialOption,
  disabled,
  label = "Article",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ItemSelectOption[]>(initialOption ? [initialOption] : []);
  const [loading, setLoading] = useState(false);
  const debounced = useDebouncedValue(query, 250);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? initialOption ?? null,
    [options, value, initialOption],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    searchItemsForSelectAction(debounced)
      .then((rows) => !cancelled && setOptions(rows))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative space-y-1">
      {label && <Label className="text-xs text-slate-500">{label}</Label>}
      <Input
        value={open ? query : selected ? itemLabel(selected) : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder="Référence, désignation, catégorie…"
        autoComplete="off"
        className="h-9"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-300 bg-white shadow-lg">
          <div className="max-h-64 overflow-auto">
            {loading && <p className="px-3 py-2 text-sm text-slate-400">Recherche…</p>}
            {!loading && options.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400">Aucun article trouvé</p>
            )}
            {!loading &&
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onValueChange(opt.id);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-emerald-50",
                    opt.id === value && "bg-emerald-50",
                  )}
                >
                  <span className="font-medium text-slate-800">{opt.name}</span>
                  <span className="text-xs text-slate-500">
                    {[opt.itemNumber, opt.categoryName].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
