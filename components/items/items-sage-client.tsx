"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Boxes,
  Copy,
  Download,
  Folder,
  LineChart,
  Package,
  PackagePlus,
  Pencil,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SageToolbar, SageActionButton } from "@/components/sage/sage-toolbar";
import { SageStatusBadge, type SageTone } from "@/components/sage/sage-status-badge";
import { SageFilterBar, SageFilterField } from "@/components/sage/sage-filter-bar";
import { SageDataGrid, type SageColumn } from "@/components/sage/sage-list-page";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import type { ItemGridRow } from "@/lib/items";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort, cn } from "@/lib/utils";
import { archiveItemAction, exportItemsGridCsvAction } from "@/server/actions/item.actions";

type Props = {
  user: SessionUser;
  rows: ItemGridRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: { id: string; name: string }[];
  filters: Record<string, string | undefined>;
};

const STATUS_TONE: Record<string, SageTone> = {
  ACTIVE: "green",
  INACTIVE: "gray",
  ARCHIVED: "slate",
  DRAFT: "blue",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
  DRAFT: "Brouillon",
};
const TYPE_LABEL: Record<string, string> = {
  PRODUCT: "Produit",
  SERVICE: "Service",
};

export function ItemsSageClient({
  user,
  rows,
  total,
  page,
  pageSize,
  totalPages,
  categories,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const canCreate = hasPermission(user, "ITEMS_CREATE");
  const canUpdate = hasPermission(user, "ITEMS_UPDATE");
  const canDelete = hasPermission(user, "ITEMS_DELETE");

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const single = selectedIds.size === 1 ? rowsById.get([...selectedIds][0]) ?? null : null;
  const currency = rows[0]?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency);

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    return `/items?${params.toString()}`;
  }

  async function handleDelete() {
    if (selectedIds.size === 0 || !canDelete) return;
    if (!window.confirm(`Archiver ${selectedIds.size} article(s) ?`)) return;
    let ok = 0;
    for (const id of selectedIds) {
      const r = await archiveItemAction(id);
      if (r.success) ok++;
    }
    toast.success(`${ok} article(s) archivé(s)`);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleExport() {
    const result = await exportItemsGridCsvAction(Object.fromEntries(searchParams.entries()));
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "articles.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  const columns: SageColumn<ItemGridRow>[] = [
    {
      key: "ref",
      header: "Référence",
      sortable: true,
      value: (r) => r.itemNumber,
      filter: { type: "text", placeholder: "Réf…" },
      render: (r) => <span className="font-mono text-[12px] text-slate-900">{r.itemNumber}</span>,
    },
    {
      key: "name",
      header: "Désignation",
      sortable: true,
      value: (r) => r.name,
      filter: { type: "text", placeholder: "Désignation…" },
      className: "max-w-[200px] truncate",
      render: (r) => <span className="font-medium text-slate-800" title={r.name}>{r.name}</span>,
    },
    {
      key: "description",
      header: "Description",
      value: (r) => r.description ?? "",
      className: "max-w-[200px] truncate",
      render: (r) => <span className="text-slate-500" title={r.description ?? ""}>{r.description || "—"}</span>,
    },
    {
      key: "category",
      header: "Catégorie",
      value: (r) => r.categoryName ?? "",
      render: (r) => <span className="text-slate-600">{r.categoryName || "—"}</span>,
    },
    {
      key: "supplier",
      header: "Fournisseur",
      value: (r) => r.supplierName ?? "",
      className: "max-w-[140px] truncate",
      render: (r) => <span className="text-slate-600" title={r.supplierName ?? ""}>{r.supplierName || "—"}</span>,
    },
    {
      key: "purchase",
      header: "Px achat HT",
      align: "right",
      sortable: true,
      value: (r) => r.purchasePriceExcludingTax,
      render: (r) => <span className="text-slate-600">{money(r.purchasePriceExcludingTax)}</span>,
    },
    {
      key: "sale",
      header: "Px vente HT",
      align: "right",
      sortable: true,
      value: (r) => r.salePriceExcludingTax,
      render: (r) => <span className="text-slate-800">{money(r.salePriceExcludingTax)}</span>,
    },
    {
      key: "vat",
      header: "TVA",
      align: "center",
      value: (r) => r.defaultVatRate,
      render: (r) => <span className="text-slate-500">{r.defaultVatRate}%</span>,
    },
    {
      key: "stockInitial",
      header: "Stock",
      align: "right",
      sortable: true,
      value: (r) => r.stockInitial,
      render: (r) => (r.isStockable ? <span className="tabular-nums text-slate-700">{r.stockInitial}</span> : <span className="text-slate-300">—</span>),
    },
    {
      key: "sold",
      header: "Qté vendue",
      align: "right",
      sortable: true,
      value: (r) => r.quantitySold,
      render: (r) => <span className="tabular-nums font-medium text-slate-800">{r.quantitySold}</span>,
      footer: (rs) => rs.reduce((s, r) => s + r.quantitySold, 0).toString(),
    },
    {
      key: "remaining",
      header: "Stock restant",
      align: "right",
      sortable: true,
      value: (r) => r.stockRemaining ?? -1,
      render: (r) =>
        r.stockRemaining === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className={cn("tabular-nums", r.stockRemaining <= 0 ? "text-red-600" : "text-slate-700")}>
            {r.stockRemaining}
          </span>
        ),
    },
    {
      key: "revenue",
      header: "CA HT vendu",
      align: "right",
      sortable: true,
      value: (r) => r.revenueExcludingTax,
      render: (r) => <span className="font-medium text-slate-900">{money(r.revenueExcludingTax)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.revenueExcludingTax, 0)),
    },
    {
      key: "lastSale",
      header: "Dernière vente",
      sortable: true,
      value: (r) => r.lastSaleDate ?? "",
      render: (r) => <span className="text-slate-600">{r.lastSaleDate ? formatDateShort(r.lastSaleDate) : "—"}</span>,
    },
    {
      key: "status",
      header: "Statut",
      value: (r) => r.status,
      filter: { type: "select", options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
      render: (r) => <SageStatusBadge label={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? "gray"} />,
    },
  ];

  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Articles &amp; services</h1>
        <p className="text-xs text-[var(--color-muted-foreground)]">Catalogue — prix, stock et ventes</p>
      </div>

      <SageToolbar>
        <SageActionButton icon={PackagePlus} label="Créer" disabled={!canCreate} onClick={() => router.push("/items/new")} />
        <SageActionButton icon={Pencil} label="Modifier" disabled={!single || !canUpdate} onClick={() => single && router.push(`/items/${single.id}/edit`)} />
        <SageActionButton icon={Trash2} label="Supprimer" disabled={selectedIds.size === 0 || !canDelete} title="Archiver les articles sélectionnés" onClick={handleDelete} />
        <SageActionButton icon={Copy} label="Dupliquer" disabled title="Fonction bientôt disponible" />
        <SageActionButton icon={LineChart} label="Voir ventes" disabled={!single} onClick={() => single && router.push(`/sales-detail?itemId=${single.id}`)} />
        <SageActionButton icon={Boxes} label="Voir stock" disabled={!single} onClick={() => single && router.push(`/items/${single.id}`)} />
        <SageActionButton icon={Package} label="Ouvrir fiche" disabled={!single} onClick={() => single && router.push(`/items/${single.id}`)} />
        <SageActionButton icon={Download} label="Exporter" onClick={handleExport} />
        <SageActionButton icon={Folder} label="Documents" disabled={!single} onClick={() => single && router.push(`/items/${single.id}`)} />
        <SageActionButton icon={Printer} label="Imprimer" disabled={!single} onClick={() => window.print()} />
        <SageActionButton icon={X} label="Fermer" onClick={() => router.push("/dashboard")} />
      </SageToolbar>

      <SageFilterBar action="/items">
        <SageFilterField label="Recherche" htmlFor="q">
          <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Référence, désignation…" className="h-9 w-56" />
        </SageFilterField>
        <SageFilterField label="Type" htmlFor="type">
          <select id="type" name="type" defaultValue={filters.type ?? ""} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Catégorie" htmlFor="categoryId">
          <select id="categoryId" name="categoryId" defaultValue={filters.categoryId ?? ""} className="h-9 w-44 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Stock" htmlFor="stockState">
          <select id="stockState" name="stockState" defaultValue={filters.stockState ?? ""} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            <option value="positive">Stock positif</option>
            <option value="zero">Stock nul</option>
            <option value="negative">Stock négatif</option>
          </select>
        </SageFilterField>
        <SageFilterField label="Vendu du" htmlFor="saleFrom">
          <Input id="saleFrom" name="saleFrom" type="date" defaultValue={filters.saleFrom ?? ""} className="h-9 w-[150px]" />
        </SageFilterField>
        <SageFilterField label="au" htmlFor="saleTo">
          <Input id="saleTo" name="saleTo" type="date" defaultValue={filters.saleTo ?? ""} className="h-9 w-[150px]" />
        </SageFilterField>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="h-9">Appliquer</Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => router.push("/items")}>Réinitialiser</Button>
        </div>
      </SageFilterBar>

      <SageDataGrid<ItemGridRow>
        columns={columns}
        rows={rows}
        getId={(r) => r.id}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenRow={(r) => router.push(`/items/${r.id}`)}
        searchPlaceholder="Rechercher dans la liste (référence, désignation, catégorie…)"
        emptyLabel="Aucun article ne correspond aux critères."
        onExport={handleExport}
        groupOptions={[
          { value: "category", label: "Par catégorie", keyOf: (r) => r.categoryName || "—" },
          { value: "supplier", label: "Par fournisseur", keyOf: (r) => r.supplierName || "—" },
          { value: "type", label: "Par type", keyOf: (r) => TYPE_LABEL[r.type] ?? r.type },
          { value: "status", label: "Par statut", keyOf: (r) => STATUS_LABEL[r.status] ?? r.status },
        ]}
        bottomBar={{
          total,
          page,
          pageSize,
          totalPages,
          exerciseLabel: `Exercice ${year} · ${total} article(s)`,
          onPage: (p) => router.push(buildUrl({ page: String(p) })),
        }}
      />
    </div>
  );
}
