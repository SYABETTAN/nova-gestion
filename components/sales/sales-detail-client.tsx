"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Contact,
  Download,
  Eye,
  FileText,
  Group,
  Package,
  Printer,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CustomerSearchSelect, type CustomerSelectOption } from "@/components/shared/customer-search-select";
import { ItemSearchSelect } from "@/components/shared/item-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemSelectOption } from "@/lib/items";
import type { SalesDetailResult, SalesDetailRow, SalesDocType } from "@/lib/sales-detail";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort, cn } from "@/lib/utils";
import { exportSalesDetailCsvAction } from "@/server/actions/sales-detail.actions";

type Props = {
  result: SalesDetailResult;
  filters: Record<string, string | undefined>;
  initialCustomerOption: CustomerSelectOption | null;
  initialItemOption: ItemSelectOption | null;
};

const CRITERIA_OPTIONS: { value: string; label: string }[] = [
  { value: "INVOICES", label: "Les factures" },
  { value: "INVOICES_VALIDATED", label: "Les factures validées" },
  { value: "INVOICES_PAID", label: "Les factures réglées" },
  { value: "INVOICES_UNPAID", label: "Les factures non réglées" },
  { value: "QUOTES", label: "Les devis" },
  { value: "CREDIT_NOTES", label: "Les avoirs" },
  { value: "ALL", label: "Toutes les pièces" },
];

const DOC_BADGE: Record<SalesDocType, { label: string; className: string }> = {
  INVOICE: { label: "Facture", className: "bg-blue-100 text-blue-800" },
  QUOTE: { label: "Devis", className: "bg-slate-100 text-slate-700" },
  CREDIT_NOTE: { label: "Avoir", className: "bg-rose-100 text-rose-800" },
};

function docHref(row: SalesDetailRow): string {
  if (row.docType === "QUOTE") return `/quotes/${row.docId}`;
  if (row.docType === "CREDIT_NOTE") return `/credit-notes/${row.docId}`;
  return `/invoices/${row.docId}`;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        "flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[11px] leading-tight transition-colors",
        disabled ? "cursor-not-allowed text-slate-300" : "text-slate-700 hover:bg-slate-100",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center">{label}</span>
    </button>
  );
}

export function SalesDetailClient({ result, filters, initialCustomerOption, initialItemOption }: Props) {
  const router = useRouter();

  const [customerId, setCustomerId] = useState(filters.customerId ?? "");
  const [itemId, setItemId] = useState(filters.itemId ?? "");
  const [representativeId, setRepresentativeId] = useState(filters.representativeId ?? "");
  const [clientMode, setClientMode] = useState<"all" | "one">(filters.customerId ? "one" : "all");
  const [articleMode, setArticleMode] = useState<"all" | "one">(filters.itemId ? "one" : "all");
  const [repMode, setRepMode] = useState<"all" | "one">(filters.representativeId ? "one" : "all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [groupBy, setGroupBy] = useState("");
  const [colFilters, setColFilters] = useState({ docNumber: "", article: "", customer: "" });
  const [exporting, setExporting] = useState(false);

  const year = new Date().getFullYear();
  const defaultFrom = filters.from ?? `${year}-01-01`;
  const defaultTo = filters.to ?? `${year}-12-31`;

  const visibleRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return result.rows.filter((r) => {
      if (colFilters.docNumber && !r.docNumber.toLowerCase().includes(colFilters.docNumber.toLowerCase()))
        return false;
      if (
        colFilters.article &&
        !`${r.reference ?? ""} ${r.name}`.toLowerCase().includes(colFilters.article.toLowerCase())
      )
        return false;
      if (
        colFilters.customer &&
        !`${r.customerName} ${r.customerCompany ?? ""}`
          .toLowerCase()
          .includes(colFilters.customer.toLowerCase())
      )
        return false;
      if (!q) return true;
      return [
        r.docNumber,
        r.name,
        r.reference ?? "",
        r.description ?? "",
        r.customerName,
        r.customerCompany ?? "",
        r.country ?? "",
        String(r.quantity),
        String(r.totalExcludingTax),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [result.rows, listSearch, colFilters]);

  const pageTotals = useMemo(() => {
    let qty = 0;
    let ht = 0;
    let vat = 0;
    let ttc = 0;
    for (const r of visibleRows) {
      qty += r.quantity;
      ht += r.totalExcludingTax;
      vat += r.totalVatAmount;
      ttc += r.totalIncludingTax;
    }
    return { qty, ht, vat, ttc };
  }, [visibleRows]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, SalesDetailRow[]>();
    for (const r of visibleRows) {
      let key = "—";
      if (groupBy === "customer") key = r.customerName;
      else if (groupBy === "article") key = r.reference ? `${r.reference} — ${r.name}` : r.name;
      else if (groupBy === "docType") key = DOC_BADGE[r.docType].label;
      else if (groupBy === "status") key = r.docStatus;
      else if (groupBy === "month") key = r.docDate.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [groupBy, visibleRows]);

  const selectedRow = visibleRows.find((r) => r.id === selectedId) ?? null;

  function buildQuery(overrides: Record<string, string>): string {
    const sp = new URLSearchParams();
    const criteria = overrides.criteria ?? filters.criteria ?? "INVOICES";
    sp.set("criteria", criteria);
    const cust = "customerId" in overrides ? overrides.customerId : clientMode === "one" ? customerId : "";
    const item = "itemId" in overrides ? overrides.itemId : articleMode === "one" ? itemId : "";
    const rep = "representativeId" in overrides ? overrides.representativeId : repMode === "one" ? representativeId : "";
    if (cust) sp.set("customerId", cust);
    if (item) sp.set("itemId", item);
    if (rep) sp.set("representativeId", rep);
    if (overrides.from ?? defaultFrom) sp.set("from", overrides.from ?? defaultFrom);
    if (overrides.to ?? defaultTo) sp.set("to", overrides.to ?? defaultTo);
    if (overrides.page) sp.set("page", overrides.page);
    return sp.toString();
  }

  function applyFilters(formData: FormData) {
    const sp = new URLSearchParams();
    sp.set("criteria", String(formData.get("criteria") ?? "INVOICES"));
    if (clientMode === "one" && customerId) sp.set("customerId", customerId);
    if (articleMode === "one" && itemId) sp.set("itemId", itemId);
    if (repMode === "one" && representativeId) sp.set("representativeId", representativeId);
    const from = String(formData.get("from") ?? "");
    const to = String(formData.get("to") ?? "");
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    router.push(`/sales-detail?${sp.toString()}`);
  }

  function openPiece(row: SalesDetailRow | null) {
    if (!row) return;
    router.push(docHref(row));
  }

  async function handleExport() {
    setExporting(true);
    const result2 = await exportSalesDetailCsvAction(filters);
    setExporting(false);
    if (result2.success && result2.csv) {
      const blob = new Blob([result2.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result2.filename ?? "detail-ventes.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  function renderRow(row: SalesDetailRow) {
    const badge = DOC_BADGE[row.docType];
    const selected = row.id === selectedId;
    return (
      <tr
        key={row.id}
        onClick={() => setSelectedId(row.id)}
        onDoubleClick={() => openPiece(row)}
        className={cn(
          "cursor-pointer border-b border-slate-100",
          selected ? "bg-emerald-50" : "hover:bg-slate-50",
        )}
      >
        <td className="px-2 py-1 text-center">
          <input type="checkbox" checked={selected} onChange={() => setSelectedId(selected ? null : row.id)} />
        </td>
        <td className="px-2 py-1">
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", badge.className)}>
            {badge.label}
          </span>
        </td>
        <td className="px-2 py-1 font-mono text-[11px] text-slate-700">{row.docNumber}</td>
        <td className="px-2 py-1 text-right text-slate-400">{row.position + 1}</td>
        <td className="px-2 py-1 font-medium text-slate-800">{row.reference ?? "—"}</td>
        <td className="max-w-[220px] truncate px-2 py-1 text-slate-700" title={row.name}>
          {row.name}
          {row.description ? <span className="text-slate-400"> — {row.description}</span> : null}
        </td>
        <td className="max-w-[160px] truncate px-2 py-1 text-slate-700" title={row.customerName}>
          {row.customerName}
        </td>
        <td className="max-w-[140px] truncate px-2 py-1 text-slate-500" title={row.customerCompany ?? ""}>
          {row.customerCompany ?? "—"}
        </td>
        <td className="whitespace-nowrap px-2 py-1 text-slate-600">{formatDateShort(row.docDate)}</td>
        <td className="px-2 py-1 text-right tabular-nums">{row.unitPriceNetHt.toFixed(2)}</td>
        <td className="px-2 py-1 text-right tabular-nums font-medium">{row.quantity}</td>
        <td className="px-2 py-1 text-right tabular-nums font-semibold text-slate-800">
          {row.totalExcludingTax.toFixed(2)}
        </td>
        <td className="px-2 py-1 text-right tabular-nums text-slate-500">{row.unitPriceGrossHt.toFixed(2)}</td>
        <td className="px-2 py-1 text-right tabular-nums text-slate-500">{row.unitPriceNetHt.toFixed(2)}</td>
        <td className="px-2 py-1 text-right tabular-nums text-slate-500">{row.unitPriceTtc.toFixed(2)}</td>
        <td className="px-2 py-1 text-right tabular-nums text-slate-500">{row.vatRate}%</td>
        <td className="px-2 py-1 text-center text-slate-500">{row.country ?? "—"}</td>
      </tr>
    );
  }

  const COLSPAN = 17;

  return (
    <div className="flex flex-col gap-3 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Détail des ventes</h1>
        <span className="text-xs text-slate-400">Détail pièces client — ligne par ligne</span>
      </div>

      {/* Barre d'actions */}
      <div className="flex flex-wrap items-stretch gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        <ToolbarButton
          icon={FileText}
          label="Ouvrir pièce"
          disabled={!selectedRow}
          onClick={() => openPiece(selectedRow)}
        />
        <ToolbarButton
          icon={Contact}
          label="Ouvrir client"
          disabled={!selectedRow?.customerId}
          onClick={() => selectedRow?.customerId && router.push(`/customers/${selectedRow.customerId}`)}
        />
        <ToolbarButton
          icon={Package}
          label="Ouvrir article"
          disabled={!selectedRow?.itemId}
          title={selectedRow && !selectedRow.itemId ? "Ligne sans article" : "Ouvrir l'article"}
          onClick={() => selectedRow?.itemId && router.push(`/items/${selectedRow.itemId}`)}
        />
        <ToolbarButton
          icon={Eye}
          label="Aperçu"
          disabled={!selectedRow}
          onClick={() => openPiece(selectedRow)}
        />
        <ToolbarButton
          icon={Printer}
          label="Imprimer"
          disabled={!selectedRow || selectedRow.docType !== "INVOICE"}
          title={selectedRow && selectedRow.docType !== "INVOICE" ? "Impression disponible sur factures" : "Imprimer"}
          onClick={() => selectedRow && window.open(`/invoices/${selectedRow.docId}/print`, "_blank")}
        />
        <ToolbarButton icon={Download} label="Exporter" disabled={exporting} onClick={handleExport} />
        <ToolbarButton icon={X} label="Fermer" onClick={() => router.push("/dashboard")} />
      </div>

      {/* Filtres hauts */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters(new FormData(e.currentTarget));
        }}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-4"
      >
        {/* Client */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={clientMode === "all"} onChange={() => { setClientMode("all"); setCustomerId(""); }} />
              Tous les clients
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={clientMode === "one"} onChange={() => setClientMode("one")} />
              Le client
            </label>
          </div>
          {clientMode === "one" && (
            <CustomerSearchSelect
              value={customerId}
              onValueChange={setCustomerId}
              initialOption={initialCustomerOption}
              label=""
            />
          )}
        </div>

        {/* Article */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={articleMode === "all"} onChange={() => { setArticleMode("all"); setItemId(""); }} />
              Tous les articles
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={articleMode === "one"} onChange={() => setArticleMode("one")} />
              L&apos;article
            </label>
          </div>
          {articleMode === "one" && (
            <ItemSearchSelect value={itemId} onValueChange={setItemId} initialOption={initialItemOption} label="" />
          )}
        </div>

        {/* Représentant */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={repMode === "all"} onChange={() => { setRepMode("all"); setRepresentativeId(""); }} />
              Tous les représentants
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={repMode === "one"}
                disabled={result.representatives.length === 0}
                onChange={() => setRepMode("one")}
              />
              Le représentant
            </label>
          </div>
          {repMode === "one" && (
            <select
              value={representativeId}
              onChange={(e) => setRepresentativeId(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="">— Sélectionner —</option>
              {result.representatives.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Période + critères */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-slate-500">Période du</Label>
              <Input type="date" name="from" defaultValue={defaultFrom} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">au</Label>
              <Input type="date" name="to" defaultValue={defaultTo} className="h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Critères</Label>
            <select
              name="criteria"
              defaultValue={filters.criteria ?? "INVOICES"}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              {CRITERIA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-end gap-2 lg:col-span-4">
          <Button type="submit" size="sm">Appliquer</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => router.push("/sales-detail")}>
            Réinitialiser
          </Button>
        </div>
      </form>

      {/* Synthèse (jeu filtré complet) */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
        <span className="font-semibold text-emerald-900">{result.totals.lineCount} lignes</span>
        <span className="text-emerald-800">{result.totals.totalQuantity} unités</span>
        <span className="text-emerald-800">{formatCurrency(result.totals.totalExcludingTax)} HT</span>
        <span className="text-emerald-800">{formatCurrency(result.totals.totalVatAmount)} TVA</span>
        <span className="font-semibold text-emerald-900">{formatCurrency(result.totals.totalIncludingTax)} TTC</span>
        <span className="text-emerald-700">· {result.totals.distinctDocuments} pièces</span>
        <span className="text-emerald-700">· {result.totals.distinctCustomers} clients</span>
        <span className="text-emerald-700">· {result.totals.distinctItems} articles</span>
        {result.capped && <span className="text-amber-700">· résultats plafonnés à 5000 lignes</span>}
      </div>

      {/* Barre secondaire */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Group className="h-4 w-4 text-slate-500" />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="">Regrouper par…</option>
            <option value="customer">Client</option>
            <option value="article">Article</option>
            <option value="docType">Type de pièce</option>
            <option value="status">Statut</option>
            <option value="month">Mois</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowColumnFilters((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium",
            showColumnFilters ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtres colonnes
        </button>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Rechercher dans la liste…"
            className="h-8 w-64 pl-8"
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          title="Exporter CSV"
          className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-400">
        {groupBy
          ? `Regroupé par ${groupBy}`
          : "Glissez-déposez ici la colonne de regroupement à ajouter (ou utilisez « Regrouper par »)."}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-420px)] overflow-auto">
          <table className="w-full min-w-[1200px] border-collapse text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <th className="w-8 px-2 py-2"></th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">N° pièce</th>
                <th className="w-10 px-2 py-2 text-right">Ind.</th>
                <th className="px-2 py-2 text-left">Article</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-left">Client</th>
                <th className="px-2 py-2 text-left">Société</th>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-right">P.U. HT rem.</th>
                <th className="px-2 py-2 text-right">Qté</th>
                <th className="px-2 py-2 text-right">Mt Total HT</th>
                <th className="px-2 py-2 text-right">P.U. Brut</th>
                <th className="px-2 py-2 text-right">P.U. Net</th>
                <th className="px-2 py-2 text-right">P.U. TTC</th>
                <th className="px-2 py-2 text-right">TVA</th>
                <th className="px-2 py-2 text-center">Pays</th>
              </tr>
              {showColumnFilters && (
                <tr className="border-b border-slate-200 bg-white">
                  <th></th>
                  <th></th>
                  <th className="px-1 py-1">
                    <input
                      value={colFilters.docNumber}
                      onChange={(e) => setColFilters((f) => ({ ...f, docNumber: e.target.value }))}
                      placeholder="N°"
                      className="h-6 w-full rounded border border-slate-200 px-1 text-[11px]"
                    />
                  </th>
                  <th></th>
                  <th className="px-1 py-1" colSpan={2}>
                    <input
                      value={colFilters.article}
                      onChange={(e) => setColFilters((f) => ({ ...f, article: e.target.value }))}
                      placeholder="Article / description"
                      className="h-6 w-full rounded border border-slate-200 px-1 text-[11px]"
                    />
                  </th>
                  <th className="px-1 py-1" colSpan={2}>
                    <input
                      value={colFilters.customer}
                      onChange={(e) => setColFilters((f) => ({ ...f, customer: e.target.value }))}
                      placeholder="Client / société"
                      className="h-6 w-full rounded border border-slate-200 px-1 text-[11px]"
                    />
                  </th>
                  <th colSpan={8}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={COLSPAN} className="px-3 py-10 text-center text-slate-400">
                    Aucune ligne de vente pour ces critères.
                  </td>
                </tr>
              )}
              {grouped
                ? grouped.map(([key, rows]) => (
                    <FragmentGroup key={key} label={key} count={rows.length} colSpan={COLSPAN}>
                      {rows.map(renderRow)}
                    </FragmentGroup>
                  ))
                : visibleRows.map(renderRow)}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold text-slate-800">
                <td colSpan={10} className="px-2 py-2 text-right text-[11px] uppercase tracking-wide text-slate-500">
                  Totaux affichés ({visibleRows.length} lignes)
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{pageTotals.qty}</td>
                <td className="px-2 py-2 text-right tabular-nums">{pageTotals.ht.toFixed(2)}</td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Barre basse */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span>
            {result.total === 0 ? "0" : `${(result.page - 1) * result.pageSize + 1}`} / {result.total}
          </span>
          <span>
            Exercice du {formatDateShort(result.exercise.from)} au {formatDateShort(result.exercise.to)}
          </span>
          <span>Actualisé aujourd&apos;hui</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={result.page <= 1}
            onClick={() => router.push(`/sales-detail?${buildQuery({ page: String(result.page - 1) })}`)}
          >
            Précédent
          </Button>
          <span className="px-2">
            Page {result.page} / {result.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={result.page >= result.totalPages}
            onClick={() => router.push(`/sales-detail?${buildQuery({ page: String(result.page + 1) })}`)}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}

function FragmentGroup({
  label,
  count,
  colSpan,
  children,
}: {
  label: string;
  count: number;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={colSpan} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label} · {count}
        </td>
      </tr>
      {children}
    </>
  );
}
