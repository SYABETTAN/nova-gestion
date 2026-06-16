"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-search";
import { searchCustomersForSelectAction } from "@/server/actions/customer.actions";
import { cn } from "@/lib/utils";

export type CustomerSelectOption = {
  id: string;
  name: string;
  displayName: string | null;
  customerNumber: string;
  email: string | null;
  phone: string | null;
  siret: string | null;
};

type CustomerSearchSelectProps = {
  value: string;
  onValueChange: (customerId: string) => void;
  initialOption?: CustomerSelectOption | null;
  disabled?: boolean;
  label?: string;
  required?: boolean;
};

function formatCustomerLabel(c: CustomerSelectOption): string {
  const parts = [c.displayName ?? c.name];
  if (c.customerNumber) parts.push(c.customerNumber);
  if (c.email) parts.push(c.email);
  return parts.join(" · ");
}

export function CustomerSearchSelect({
  value,
  onValueChange,
  initialOption,
  disabled,
  label = "Client",
  required,
}: CustomerSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CustomerSelectOption[]>(
    initialOption ? [initialOption] : [],
  );
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => {
    return options.find((o) => o.id === value) ?? initialOption ?? null;
  }, [options, value, initialOption]);

  useEffect(() => {
    if (initialOption && !options.some((o) => o.id === initialOption.id)) {
      setOptions((prev) => [initialOption, ...prev]);
    }
  }, [initialOption, options]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    searchCustomersForSelectAction(debouncedQuery)
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        value={open ? query : selected ? formatCustomerLabel(selected) : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher par nom, email, téléphone, SIRET…"
        disabled={disabled}
        autoComplete="off"
      />
      {selected && !open && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {selected.phone ? `Tél. ${selected.phone}` : null}
          {selected.phone && selected.siret ? " · " : null}
          {selected.siret ? `SIRET ${selected.siret}` : null}
        </p>
      )}
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-lg">
          {loading && (
            <p className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]">Recherche…</p>
          )}
          {!loading && options.length === 0 && (
            <p className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]">Aucun client trouvé</p>
          )}
          {!loading &&
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50",
                  option.id === value && "bg-slate-100",
                )}
                onClick={() => {
                  onValueChange(option.id);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{option.displayName ?? option.name}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {[option.customerNumber, option.email, option.phone, option.siret]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
