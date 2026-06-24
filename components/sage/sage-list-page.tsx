"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Group,
  Mail,
  Printer,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SageColumnFilter =
  | { type: "text"; placeholder?: string }
  | { type: "select"; options: { value: string; label: string }[] };

export type SageColumn<Row> = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: Row, index: number) => React.ReactNode;
  /** Valeur utilisée pour la recherche globale, le filtre colonne texte et le tri. */
  value?: (row: Row) => string | number | null | undefined;
  filter?: SageColumnFilter;
  /** Matcher personnalisé pour le filtre colonne (sinon: includes / equals sur value). */
  filterMatch?: (row: Row, filterValue: string) => boolean;
  sortable?: boolean;
  /** Cellule de pied de tableau (totaux). */
  footer?: (rows: Row[]) => React.ReactNode;
};

export type SageGroupOption<Row> = {
  value: string;
  label: string;
  keyOf: (row: Row) => string;
};

type BottomBar = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  exerciseLabel?: string;
  onPage: (page: number) => void;
};

type Props<Row> = {
  columns: SageColumn<Row>[];
  rows: Row[];
  getId: (row: Row) => string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onOpenRow?: (row: Row) => void;
  groupOptions?: SageGroupOption<Row>[];
  searchPlaceholder?: string;
  emptyLabel?: string;
  onExport?: () => void;
  bottomBar: BottomBar;
};

export function SageDataGrid<Row>({
  columns,
  rows,
  getId,
  selectedIds,
  onSelectionChange,
  onOpenRow,
  groupOptions,
  searchPlaceholder = "Rechercher dans la liste",
  emptyLabel = "Aucun enregistrement ne correspond aux critères.",
  onExport,
  bottomBar,
}: Props<Row>) {
  const [listSearch, setListSearch] = useState("");
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [groupBy, setGroupBy] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  function valueOf(col: SageColumn<Row>, row: Row): string {
    const v = col.value?.(row);
    return v === null || v === undefined ? "" : String(v);
  }

  const visibleRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    let result = rows.filter((row) => {
      if (q) {
        const haystack = columns
          .map((c) => valueOf(c, row))
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      for (const col of columns) {
        const fv = colFilters[col.key];
        if (!fv) continue;
        if (col.filterMatch) {
          if (!col.filterMatch(row, fv)) return false;
        } else if (col.filter?.type === "select") {
          if (valueOf(col, row) !== fv) return false;
        } else if (!valueOf(col, row).toLowerCase().includes(fv.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        result = [...result].sort((a, b) => {
          const av = col.value?.(a);
          const bv = col.value?.(b);
          let cmp: number;
          if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
          else cmp = String(av ?? "").localeCompare(String(bv ?? ""), "fr", { numeric: true });
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, listSearch, colFilters, sort]);

  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selectedIds.has(getId(r))),
    [visibleRows, selectedIds, getId],
  );
  const footerRows = selectedRows.length > 0 ? selectedRows : visibleRows;

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const opt = groupOptions?.find((g) => g.value === groupBy);
    if (!opt) return null;
    const map = new Map<string, Row[]>();
    for (const row of visibleRows) {
      const key = opt.keyOf(row) || "—";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [groupBy, visibleRows, groupOptions]);

  const allChecked = visibleRows.length > 0 && selectedRows.length >= visibleRows.length;

  function selectOnly(id: string) {
    onSelectionChange(new Set([id]));
  }
  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }
  function toggleAll() {
    if (allChecked) onSelectionChange(new Set());
    else onSelectionChange(new Set(visibleRows.map(getId)));
  }

  function toggleSort(col: SageColumn<Row>) {
    if (!col.sortable) return;
    setSort((prev) =>
      prev?.key === col.key
        ? { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: col.key, dir: "asc" },
    );
  }

  const colSpan = columns.length + 1;
  const hasFooter = columns.some((c) => c.footer);

  function renderRow(row: Row, index: number) {
    const id = getId(row);
    const selected = selectedIds.has(id);
    return (
      <tr
        key={id}
        onClick={() => selectOnly(id)}
        onDoubleClick={() => onOpenRow?.(row)}
        className={cn(
          "cursor-default border-b border-slate-100 transition-colors",
          selected ? "bg-blue-50" : index % 2 === 1 ? "bg-slate-50/60" : "bg-white",
          "hover:bg-blue-50/70",
        )}
      >
        <td className="w-8 px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleOne(id)}
            className="h-3.5 w-3.5 cursor-pointer"
          />
        </td>
        {columns.map((col) => (
          <td
            key={col.key}
            className={cn(
              "px-2 py-1",
              col.align === "right" && "text-right tabular-nums",
              col.align === "center" && "text-center",
              col.className,
            )}
          >
            {col.render(row, index)}
          </td>
        ))}
      </tr>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {/* Barre secondaire */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        {groupOptions && groupOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Group className="h-4 w-4" />
                Regroupement
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setGroupBy("")}>Aucun</DropdownMenuItem>
              {groupOptions.map((g) => (
                <DropdownMenuItem key={g.value} onClick={() => setGroupBy(g.value)}>
                  {g.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant={showColumnFilters ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setShowColumnFilters((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
        </Button>

        <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled title="Bientôt disponible">
          <Eye className="h-4 w-4" />
          Vues
        </Button>

        <div className="relative ml-auto flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-64 pl-8"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          title="Imprimer la liste"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          title={onExport ? "Exporter CSV" : "Export bientôt disponible"}
          disabled={!onExport}
          onClick={onExport}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" title="Email — bientôt disponible" disabled>
          <Mail className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" title="Colonnes — bientôt disponible" disabled>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-400">
        {groupBy
          ? `Regroupé par : ${groupOptions?.find((g) => g.value === groupBy)?.label} — utilisez « Regroupement » pour changer`
          : "Glisser-déposer ici la colonne de regroupement à ajouter (ou utilisez « Regroupement »)"}
      </div>

      {/* Tableau dense */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-360px)] overflow-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <th className="w-8 px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 cursor-pointer"
                  />
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col)}
                    className={cn(
                      "px-2 py-2 font-semibold",
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                      col.sortable && "cursor-pointer select-none hover:text-slate-900",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sort?.key === col.key &&
                        (sort.dir === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
              {showColumnFilters && (
                <tr className="border-b border-slate-200 bg-white">
                  <th />
                  {columns.map((col) => (
                    <th key={col.key} className="px-1 py-1">
                      {col.filter?.type === "text" && (
                        <input
                          value={colFilters[col.key] ?? ""}
                          onChange={(e) =>
                            setColFilters((c) => ({ ...c, [col.key]: e.target.value }))
                          }
                          placeholder={col.filter.placeholder ?? "…"}
                          className="h-7 w-full rounded border border-slate-200 px-1.5 text-[11px]"
                        />
                      )}
                      {col.filter?.type === "select" && (
                        <select
                          value={colFilters[col.key] ?? ""}
                          onChange={(e) =>
                            setColFilters((c) => ({ ...c, [col.key]: e.target.value }))
                          }
                          className="h-7 w-full rounded border border-slate-200 px-1 text-[11px]"
                        >
                          <option value="">Tous</option>
                          {col.filter.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-400">
                    {emptyLabel}
                  </td>
                </tr>
              ) : grouped ? (
                grouped.map(([key, groupRows]) => (
                  <FragmentGroup key={key}>
                    <tr className="border-b border-slate-200 bg-slate-100/80">
                      <td colSpan={colSpan} className="px-2 py-1.5 text-[12px] font-semibold text-slate-700">
                        {key} <span className="font-normal text-slate-400">({groupRows.length})</span>
                      </td>
                    </tr>
                    {groupRows.map((row, i) => renderRow(row, i))}
                  </FragmentGroup>
                ))
              ) : (
                visibleRows.map((row, i) => renderRow(row, i))
              )}
            </tbody>
            {hasFooter && (
              <tfoot className="sticky bottom-0">
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold text-slate-800">
                  <td className="px-2 py-2" />
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-2 py-2",
                        col.align === "right" && "text-right tabular-nums",
                        col.align === "center" && "text-center",
                      )}
                    >
                      {col.footer
                        ? col.footer(footerRows)
                        : i === 0
                          ? selectedRows.length > 0
                            ? `Totaux sélection (${selectedRows.length})`
                            : `Totaux (${visibleRows.length})`
                          : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Barre basse */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-medium text-slate-700">
            {visibleRows.length} / {bottomBar.total}
          </span>
          {bottomBar.exerciseLabel && <span>{bottomBar.exerciseLabel}</span>}
          <span>Actualisé aujourd&apos;hui</span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Page {bottomBar.page} / {bottomBar.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            disabled={bottomBar.page <= 1}
            onClick={() => bottomBar.onPage(bottomBar.page - 1)}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            disabled={bottomBar.page >= bottomBar.totalPages}
            onClick={() => bottomBar.onPage(bottomBar.page + 1)}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
