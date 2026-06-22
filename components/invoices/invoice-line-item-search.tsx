"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, PackagePlus } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-search";
import { searchItemsForSelectAction } from "@/server/actions/item.actions";
import type { ItemSelectOption } from "@/lib/items";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  itemId: string | null;
  onTextChange: (text: string) => void;
  onSelect: (item: ItemSelectOption) => void;
  onRequestCreate: (query: string) => void;
  disabled?: boolean;
};

export function InvoiceLineItemSearch({
  value,
  itemId,
  onTextChange,
  onSelect,
  onRequestCreate,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ItemSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const debounced = useDebouncedValue(value, 250);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function updateRect() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom, width: Math.max(r.width, 320) });
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    searchItemsForSelectAction(debounced)
      .then((rows) => {
        if (!cancelled) {
          setOptions(rows);
          setActiveIndex(0);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    function onScroll() {
      updateRect();
    }
    function onClickOutside(e: MouseEvent) {
      if (
        inputRef.current?.contains(e.target as Node) ||
        popRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  function choose(item: ItemSelectOption) {
    onSelect(item);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && options[activeIndex]) {
      e.preventDefault();
      choose(options[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onTextChange(e.target.value);
          if (!open) setOpen(true);
          updateRect();
        }}
        onFocus={() => {
          setOpen(true);
          updateRect();
        }}
        onKeyDown={onKeyDown}
        placeholder="Article…"
        autoComplete="off"
        className="h-7 w-full rounded border border-transparent bg-transparent px-1 text-[12px] hover:border-slate-200 focus:border-emerald-400 focus:bg-white focus:outline-none"
      />
      {open && rect && (
        <div
          ref={popRef}
          style={{ position: "fixed", left: rect.left, top: rect.top + 2, width: rect.width, zIndex: 60 }}
          className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-lg"
        >
          <div className="border-b bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Recherche rapide article
          </div>
          <div className="max-h-60 overflow-auto">
            {loading && <p className="px-3 py-2 text-xs text-slate-400">Recherche…</p>}
            {!loading && options.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">Aucun article trouvé</p>
            )}
            {!loading &&
              options.map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(opt)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs",
                    i === activeIndex ? "bg-emerald-50" : "hover:bg-slate-50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] text-slate-500">{opt.itemNumber}</span>{" "}
                    <span className="font-medium text-slate-800">{opt.name}</span>
                    {opt.isStockable && (
                      <span className="ml-1 text-[10px] text-slate-400">stock {opt.stockQuantity}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {opt.salePriceExcludingTax.toFixed(2)} € HT
                  </span>
                </button>
              ))}
          </div>
          <div className="flex items-center justify-between border-t bg-slate-50 px-2 py-1.5">
            {itemId ? (
              <Link
                href={`/items/${itemId}`}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                onClick={() => setOpen(false)}
              >
                <ExternalLink className="h-3 w-3" />
                Afficher la fiche complète
              </Link>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => {
                onRequestCreate(value);
                setOpen(false);
              }}
              className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
            >
              <PackagePlus className="h-3 w-3" />
              Créer un nouvel article
            </button>
          </div>
        </div>
      )}
    </>
  );
}
