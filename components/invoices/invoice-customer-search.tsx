"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, UserPlus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-search";
import { searchCustomersForSelectAction } from "@/server/actions/customer.actions";
import type { CustomerSelectOption } from "@/components/shared/customer-search-select";
import { cn } from "@/lib/utils";

type Props = {
  selected: CustomerSelectOption | null;
  onSelect: (option: CustomerSelectOption) => void;
  onRequestCreate: (query: string) => void;
  disabled?: boolean;
};

function label(c: CustomerSelectOption): string {
  return [c.displayName ?? c.name, c.customerNumber].filter(Boolean).join(" · ");
}

export function InvoiceCustomerSearch({ selected, onSelect, onRequestCreate, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CustomerSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebouncedValue(query, 250);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    searchCustomersForSelectAction(debounced)
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
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(option: CustomerSelectOption) {
    onSelect(option);
    setQuery("");
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
    } else if (e.key === "Enter" && options[activeIndex]) {
      e.preventDefault();
      choose(options[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={open ? query : selected ? label(selected) : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Code, nom, société, SIREN, SIRET, email, téléphone…"
          autoComplete="off"
          className="h-9 pl-8 font-medium"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-300 bg-white shadow-lg">
          <div className="border-b bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Recherche rapide
          </div>
          <div className="max-h-64 overflow-auto">
            {loading && <p className="px-3 py-2 text-sm text-slate-400">Recherche…</p>}
            {!loading && options.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400">Aucun client trouvé</p>
            )}
            {!loading &&
              options.map((option, i) => (
                <button
                  key={option.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-1.5 text-left text-sm",
                    i === activeIndex ? "bg-emerald-50" : "hover:bg-slate-50",
                  )}
                >
                  <span className="font-medium text-slate-800">{option.displayName ?? option.name}</span>
                  <span className="text-xs text-slate-500">
                    {[option.customerNumber, option.email, option.phone, option.siret]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              ))}
          </div>
          <div className="flex items-center justify-between border-t bg-slate-50 px-2 py-1.5">
            {selected ? (
              <Link
                href={`/customers/${selected.id}`}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                onClick={() => setOpen(false)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Afficher la fiche complète
              </Link>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => {
                onRequestCreate(query);
                setOpen(false);
              }}
              className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Créer un nouveau client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
