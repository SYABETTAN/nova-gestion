"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookCheck,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Folder,
  Group,
  Mail,
  Pencil,
  Printer,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerFilterField } from "@/components/shared/customer-filter-field";
import type { CustomerSelectOption } from "@/components/shared/customer-search-select";
import { InvoicePiecesNav } from "@/components/invoices/invoice-pieces-nav";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import type { InvoiceGridRow } from "@/lib/invoices";
import { canMarkPaid, isInvoiceOverdue } from "@/lib/invoice-status";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort, cn } from "@/lib/utils";
import {
  archiveInvoiceAction,
  duplicateInvoiceAction,
  exportInvoicesCsvAction,
} from "@/server/actions/invoice.actions";
import { validateInvoiceAction } from "@/server/actions/invoice-status.actions";
import { generateAccountingEntryFromCustomerInvoiceAction } from "@/server/actions/accounting-generator.actions";

type Totals = {
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  amountDue: number;
};

type Props = {
  user: SessionUser;
  invoices: InvoiceGridRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totals: Totals;
  exercise: { from: Date | null; to: Date | null };
  initialCustomerOption: CustomerSelectOption | null;
  filters: Record<string, string | undefined>;
};

const CRITERIA_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Toutes les factures" },
  { value: "PROVISIONAL", label: "Les factures provisoires" },
  { value: "SETTLED", label: "Les factures soldées" },
  { value: "TO_REMIND", label: "Les factures à relancer" },
  { value: "UNPAID", label: "Les factures non réglées" },
  { value: "VALIDATED_UNPAID", label: "Les factures validées non réglées" },
  { value: "ACCOUNTED", label: "Les factures comptabilisées" },
  { value: "NOT_ACCOUNTED", label: "Les factures non comptabilisées" },
];

type SageStatus = { key: string; label: string; cls: string };

function getSageStatus(row: InvoiceGridRow): SageStatus {
  if (row.status === "CANCELLED") {
    return { key: "cancelled", label: "Annulée", cls: "bg-slate-200 text-slate-600" };
  }
  if (row.status === "CREDITED") {
    return { key: "credited", label: "Créditée", cls: "bg-slate-200 text-slate-700" };
  }
  if (row.status === "DRAFT") {
    return { key: "provisional", label: "Provisoire", cls: "bg-blue-100 text-blue-800" };
  }
  if (row.amountDue <= 0 || row.status === "PAID") {
    return { key: "settled", label: "Soldée", cls: "bg-emerald-100 text-emerald-800" };
  }
  if (
    row.status === "OVERDUE" ||
    row.paymentStatus === "OVERDUE" ||
    isInvoiceOverdue(row.dueDate, row.paymentStatus)
  ) {
    return { key: "to_remind", label: "À relancer", cls: "bg-red-100 text-red-800" };
  }
  if (row.status === "PARTIALLY_PAID") {
    return { key: "partial", label: "Part. réglée", cls: "bg-amber-100 text-amber-800" };
  }
  return { key: "validated", label: "Non réglée", cls: "bg-sky-100 text-sky-800" };
}

function StatusBadge({ row }: { row: InvoiceGridRow }) {
  const s = getSageStatus(row);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
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
        "flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] leading-tight transition-colors",
        disabled
          ? "cursor-not-allowed text-slate-300"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center">{label}</span>
    </button>
  );
}

function num(value: number, currency: string) {
  return formatCurrency(value, currency);
}

export function InvoicesSageClient({
  user,
  invoices,
  total,
  page,
  pageSize,
  totalPages,
  totals,
  exercise,
  initialCustomerOption,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [listSearch, setListSearch] = useState("");
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [groupBy, setGroupBy] = useState<"" | "customer" | "status" | "accounted" | "month">("");
  const [colFilters, setColFilters] = useState({
    number: "",
    company: "",
    status: "",
    accounted: "",
    country: "",
  });
  const listSearchRef = useRef<HTMLInputElement>(null);

  const canCreate = hasPermission(user, "INVOICES_CREATE");
  const canUpdate = hasPermission(user, "INVOICES_UPDATE");
  const canValidate = hasPermission(user, "INVOICES_VALIDATE");
  const canCancel = hasPermission(user, "INVOICES_CANCEL");
  const canPay = hasPermission(user, "PAYMENTS_CREATE");
  const canAccount = hasPermission(user, "ACCOUNTING_CREATE");

  const rowsById = useMemo(() => {
    const map = new Map<string, InvoiceGridRow>();
    invoices.forEach((r) => map.set(r.id, r));
    return map;
  }, [invoices]);

  const visibleRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return invoices.filter((row) => {
      const sage = getSageStatus(row);
      if (q) {
        const haystack = [
          row.invoiceNumber,
          row.customerName,
          row.companyName,
          row.customerNumber,
          sage.label,
          row.country,
          row.totalIncludingTax.toFixed(2),
          row.amountDue.toFixed(2),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (colFilters.number && !row.invoiceNumber.toLowerCase().includes(colFilters.number.toLowerCase()))
        return false;
      if (
        colFilters.company &&
        !`${row.companyName} ${row.customerName}`.toLowerCase().includes(colFilters.company.toLowerCase())
      )
        return false;
      if (colFilters.status && sage.key !== colFilters.status) return false;
      if (colFilters.accounted === "yes" && !row.isAccounted) return false;
      if (colFilters.accounted === "no" && row.isAccounted) return false;
      if (colFilters.country && !row.country.toLowerCase().includes(colFilters.country.toLowerCase()))
        return false;
      return true;
    });
  }, [invoices, listSearch, colFilters]);

  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selectedIds.has(r.id)),
    [visibleRows, selectedIds],
  );

  const footerRows = selectedRows.length > 0 ? selectedRows : visibleRows;
  const footerTotals = useMemo<Totals>(() => {
    return footerRows.reduce<Totals>(
      (acc, r) => ({
        totalExcludingTax: acc.totalExcludingTax + r.totalExcludingTax,
        totalVatAmount: acc.totalVatAmount + r.totalVatAmount,
        totalIncludingTax: acc.totalIncludingTax + r.totalIncludingTax,
        amountDue: acc.amountDue + r.amountDue,
      }),
      { totalExcludingTax: 0, totalVatAmount: 0, totalIncludingTax: 0, amountDue: 0 },
    );
  }, [footerRows]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const groups = new Map<string, InvoiceGridRow[]>();
    for (const row of visibleRows) {
      let key = "";
      if (groupBy === "customer") key = row.companyName || row.customerName;
      else if (groupBy === "status") key = getSageStatus(row).label;
      else if (groupBy === "accounted") key = row.isAccounted ? "Comptabilisées" : "Non comptabilisées";
      else if (groupBy === "month")
        key = new Date(row.issueDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [groupBy, visibleRows]);

  const single = selectedIds.size === 1 ? rowsById.get([...selectedIds][0]) ?? null : null;
  const currency = invoices[0]?.currency ?? "EUR";

  function selectOnly(id: string) {
    setSelectedIds(new Set([id]));
  }
  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === visibleRows.length && visibleRows.length > 0
        ? new Set()
        : new Set(visibleRows.map((r) => r.id)),
    );
  }

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    return `/invoices?${params.toString()}`;
  }

  async function runAction(
    fn: () => Promise<{ success: boolean; error?: string; message?: string }>,
    okMsg: string,
  ) {
    const result = await fn();
    if (result.success) {
      toast.success(result.message ?? okMsg);
      router.refresh();
    } else {
      toast.error(result.error ?? "Action impossible");
    }
  }

  function openDetail(id: string) {
    router.push(`/invoices/${id}`);
  }

  async function handleDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Archiver ${selectedIds.size} facture(s) sélectionnée(s) ?`)) return;
    let ok = 0;
    for (const id of selectedIds) {
      const r = await archiveInvoiceAction(id);
      if (r.success) ok++;
    }
    toast.success(`${ok} facture(s) archivée(s)`);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleExport() {
    const result = await exportInvoicesCsvAction(Object.fromEntries(searchParams.entries()));
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "factures.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  const defaultYear = new Date().getFullYear();
  const defaultFrom = filters.issueDateFrom ?? `${defaultYear}-01-01`;
  const defaultTo = filters.issueDateTo ?? `${defaultYear}-12-31`;
  const [clientMode, setClientMode] = useState<"all" | "one">(filters.customerId ? "one" : "all");

  const allChecked = visibleRows.length > 0 && selectedIds.size >= visibleRows.length;

  const COLSPAN = 14;

  function renderRow(row: InvoiceGridRow, index: number) {
    const selected = selectedIds.has(row.id);
    return (
      <tr
        key={row.id}
        onClick={() => selectOnly(row.id)}
        onDoubleClick={() => openDetail(row.id)}
        className={cn(
          "cursor-default border-b border-slate-100 transition-colors",
          selected ? "bg-blue-50" : index % 2 === 1 ? "bg-slate-50/60" : "bg-white",
          "hover:bg-blue-50/70",
        )}
      >
        <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleOne(row.id)}
            className="h-3.5 w-3.5 cursor-pointer"
            aria-label={`Sélectionner ${row.invoiceNumber}`}
          />
        </td>
        <td className="px-2 py-1 text-right text-[11px] text-slate-400">{index + 1}</td>
        <td className="whitespace-nowrap px-2 py-1 font-mono text-[12px] font-medium text-slate-900">
          {row.invoiceNumber}
        </td>
        <td className="px-2 py-1">
          <StatusBadge row={row} />
        </td>
        <td className="px-2 py-1 text-center">
          {row.isAccounted ? (
            <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="whitespace-nowrap px-2 py-1 text-slate-700">{formatDateShort(row.issueDate)}</td>
        <td className="max-w-[160px] truncate px-2 py-1 text-slate-800" title={row.customerName}>
          {row.customerName}
        </td>
        <td className="max-w-[160px] truncate px-2 py-1 text-slate-600" title={row.companyName}>
          {row.companyName}
        </td>
        <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-700">
          {num(row.totalExcludingTax, row.currency)}
        </td>
        <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-700">
          {num(row.totalVatAmount, row.currency)}
        </td>
        <td className="whitespace-nowrap px-2 py-1 text-right font-medium tabular-nums text-slate-900">
          {num(row.totalIncludingTax, row.currency)}
        </td>
        <td
          className={cn(
            "whitespace-nowrap px-2 py-1 text-right font-medium tabular-nums",
            row.amountDue > 0 ? "text-red-600" : "text-emerald-600",
          )}
        >
          {num(row.amountDue, row.currency)}
        </td>
        <td className="whitespace-nowrap px-2 py-1 text-center text-slate-500">
          {row.paymentTermsDays} j
        </td>
        <td className="px-2 py-1 text-center text-slate-500">{row.country || "—"}</td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Factures</h1>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Gestion commerciale — pièces de vente
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <InvoicePiecesNav activeKey="invoices" />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* 1. Barre d'actions type Sage */}
          <div className="flex flex-wrap items-stretch gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
            <ToolbarButton
              icon={FilePlus2}
              label="Créer"
              disabled={!canCreate}
              onClick={() => router.push("/invoices/new")}
            />
            <ToolbarButton
              icon={Pencil}
              label="Modifier"
              disabled={!single || single.status !== "DRAFT" || !canUpdate}
              title={
                single && single.status !== "DRAFT"
                  ? "Seules les factures provisoires sont modifiables"
                  : "Modifier la facture sélectionnée"
              }
              onClick={() => single && router.push(`/invoices/${single.id}/edit`)}
            />
            <ToolbarButton
              icon={Trash2}
              label="Supprimer"
              disabled={selectedIds.size === 0 || !canCancel}
              title="Archiver les factures sélectionnées"
              onClick={handleDelete}
            />
            <ToolbarButton
              icon={Eye}
              label="Aperçu"
              disabled={!single}
              onClick={() => single && openDetail(single.id)}
            />
            <ToolbarButton
              icon={Printer}
              label="Imprimer"
              disabled={!single}
              onClick={() => single && window.open(`/invoices/${single.id}/print`, "_blank")}
            />
            <ToolbarButton
              icon={Check}
              label="Valider"
              disabled={!single || single.status !== "DRAFT" || !canValidate}
              title={
                single && single.status !== "DRAFT"
                  ? "Facture déjà validée"
                  : "Valider la facture sélectionnée"
              }
              onClick={() => single && runAction(() => validateInvoiceAction(single.id), "Facture validée")}
            />
            <ToolbarButton
              icon={Wallet}
              label="Régler"
              disabled={!single || !canMarkPaid(single.status) || single.amountDue <= 0 || !canPay}
              title="Enregistrer un règlement"
              onClick={() => single && router.push(`/payments/new?invoiceId=${single.id}`)}
            />
            <ToolbarButton icon={FileText} label="Transférer" disabled title="Fonction bientôt disponible" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] leading-tight text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                  <span className="flex items-center">
                    Options <ChevronDown className="h-3 w-3" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">Options</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!single || !canCreate}
                  onClick={() =>
                    single && runAction(() => duplicateInvoiceAction(single.id), "Facture dupliquée")
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Dupliquer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Exporter CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ToolbarButton
              icon={BookCheck}
              label="Générer l'écriture"
              disabled={
                !single ||
                single.status === "DRAFT" ||
                single.status === "CANCELLED" ||
                single.isAccounted ||
                !canAccount
              }
              title={
                single?.isAccounted
                  ? "Facture déjà comptabilisée"
                  : "Générer l'écriture comptable"
              }
              onClick={() =>
                single &&
                runAction(
                  () => generateAccountingEntryFromCustomerInvoiceAction(single.id),
                  "Écriture comptable générée",
                )
              }
            />
            <ToolbarButton
              icon={FileText}
              label="Ouvrir facture"
              disabled={!single}
              onClick={() => single && openDetail(single.id)}
            />
            <ToolbarButton
              icon={Wallet}
              label="Ouvrir fac. encaiss."
              disabled
              title="Fonction bientôt disponible"
            />
            <ToolbarButton
              icon={Folder}
              label="Documents liés"
              disabled={!single}
              title="Documents liés à la facture"
              onClick={() => single && openDetail(single.id)}
            />
            <ToolbarButton
              icon={X}
              label="Fermer"
              onClick={() => router.push("/dashboard")}
            />
          </div>

          {/* 3. Zone filtres haute (client / période / critères) */}
          <form
            method="get"
            action="/invoices"
            className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <fieldset className="space-y-1">
              <Label className="text-xs text-slate-500">Client</Label>
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="clientMode"
                    checked={clientMode === "all"}
                    onChange={() => setClientMode("all")}
                  />
                  Tous les clients
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="clientMode"
                    checked={clientMode === "one"}
                    onChange={() => setClientMode("one")}
                  />
                  Le client
                </label>
              </div>
            </fieldset>

            {clientMode === "one" ? (
              <div className="w-72">
                <CustomerFilterField
                  initialCustomerId={filters.customerId}
                  initialOption={initialCustomerOption}
                />
              </div>
            ) : (
              <input type="hidden" name="customerId" value="" />
            )}

            <div className="space-y-1">
              <Label htmlFor="issueDateFrom" className="text-xs text-slate-500">
                Période du
              </Label>
              <Input
                id="issueDateFrom"
                name="issueDateFrom"
                type="date"
                defaultValue={defaultFrom}
                className="h-9 w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="issueDateTo" className="text-xs text-slate-500">
                au
              </Label>
              <Input
                id="issueDateTo"
                name="issueDateTo"
                type="date"
                defaultValue={defaultTo}
                className="h-9 w-[150px]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="criteria" className="text-xs text-slate-500">
                Critères
              </Label>
              <select
                id="criteria"
                name="criteria"
                defaultValue={filters.criteria ?? "ALL"}
                className="h-9 w-[260px] rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                {CRITERIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" className="h-9">
                Appliquer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => router.push("/invoices")}
              >
                Réinitialiser
              </Button>
            </div>
          </form>

          {/* 4. Barre secondaire (regroupement / filtres / vues / recherche) */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
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
                <DropdownMenuItem onClick={() => setGroupBy("customer")}>Par client</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGroupBy("status")}>Par statut</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGroupBy("accounted")}>
                  Par comptabilisation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGroupBy("month")}>Par mois</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
                ref={listSearchRef}
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Rechercher dans la liste"
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
              title="Exporter par email — bientôt disponible"
              disabled
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Paramètres d'affichage — bientôt disponible"
              disabled
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Zone de regroupement (drag & drop visuel) */}
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-400">
            {groupBy
              ? `Regroupé par : ${
                  { customer: "Client", status: "Statut", accounted: "Comptabilisation", month: "Mois" }[
                    groupBy
                  ]
                } — utilisez « Regroupement » pour changer`
              : "Glisser-déposer ici la colonne de regroupement à ajouter (ou utilisez « Regroupement »)"}
          </div>

          {/* 5. Tableau dense */}
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
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="w-8 px-2 py-2 text-right">#</th>
                    <th className="px-2 py-2 text-left">N° pièce</th>
                    <th className="px-2 py-2 text-left">Statut</th>
                    <th className="px-2 py-2 text-center">Compta.</th>
                    <th className="px-2 py-2 text-left">Date pièce</th>
                    <th className="px-2 py-2 text-left">Client</th>
                    <th className="px-2 py-2 text-left">Société</th>
                    <th className="px-2 py-2 text-right">Total HT</th>
                    <th className="px-2 py-2 text-right">Total TVA</th>
                    <th className="px-2 py-2 text-right">Total TTC</th>
                    <th className="px-2 py-2 text-right">Solde dû</th>
                    <th className="px-2 py-2 text-center">Règlt</th>
                    <th className="px-2 py-2 text-center">Pays</th>
                  </tr>
                  {showColumnFilters && (
                    <tr className="border-b border-slate-200 bg-white">
                      <th />
                      <th />
                      <th className="px-1 py-1">
                        <input
                          value={colFilters.number}
                          onChange={(e) => setColFilters((c) => ({ ...c, number: e.target.value }))}
                          placeholder="N°…"
                          className="h-7 w-full rounded border border-slate-200 px-1.5 text-[11px]"
                        />
                      </th>
                      <th className="px-1 py-1">
                        <select
                          value={colFilters.status}
                          onChange={(e) => setColFilters((c) => ({ ...c, status: e.target.value }))}
                          className="h-7 w-full rounded border border-slate-200 px-1 text-[11px]"
                        >
                          <option value="">Tous</option>
                          <option value="provisional">Provisoire</option>
                          <option value="validated">Non réglée</option>
                          <option value="partial">Part. réglée</option>
                          <option value="to_remind">À relancer</option>
                          <option value="settled">Soldée</option>
                          <option value="cancelled">Annulée</option>
                          <option value="credited">Créditée</option>
                        </select>
                      </th>
                      <th className="px-1 py-1">
                        <select
                          value={colFilters.accounted}
                          onChange={(e) => setColFilters((c) => ({ ...c, accounted: e.target.value }))}
                          className="h-7 w-full rounded border border-slate-200 px-1 text-[11px]"
                        >
                          <option value="">Toutes</option>
                          <option value="yes">Oui</option>
                          <option value="no">Non</option>
                        </select>
                      </th>
                      <th />
                      <th />
                      <th className="px-1 py-1">
                        <input
                          value={colFilters.company}
                          onChange={(e) => setColFilters((c) => ({ ...c, company: e.target.value }))}
                          placeholder="Société…"
                          className="h-7 w-full rounded border border-slate-200 px-1.5 text-[11px]"
                        />
                      </th>
                      <th />
                      <th />
                      <th />
                      <th />
                      <th />
                      <th className="px-1 py-1">
                        <input
                          value={colFilters.country}
                          onChange={(e) => setColFilters((c) => ({ ...c, country: e.target.value }))}
                          placeholder="Pays"
                          className="h-7 w-full rounded border border-slate-200 px-1.5 text-[11px]"
                        />
                      </th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLSPAN} className="px-4 py-10 text-center text-sm text-slate-400">
                        Aucune facture ne correspond aux critères.
                      </td>
                    </tr>
                  ) : grouped ? (
                    grouped.map(([groupKey, rows]) => {
                      const gTtc = rows.reduce((s, r) => s + r.totalIncludingTax, 0);
                      const gDue = rows.reduce((s, r) => s + r.amountDue, 0);
                      return (
                        <FragmentGroup key={groupKey}>
                          <tr className="border-b border-slate-200 bg-slate-100/80">
                            <td colSpan={8} className="px-2 py-1.5 text-[12px] font-semibold text-slate-700">
                              {groupKey}{" "}
                              <span className="font-normal text-slate-400">({rows.length})</span>
                            </td>
                            <td colSpan={2} />
                            <td className="px-2 py-1.5 text-right text-[12px] font-semibold tabular-nums text-slate-700">
                              {num(gTtc, currency)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[12px] font-semibold tabular-nums text-red-600">
                              {num(gDue, currency)}
                            </td>
                            <td colSpan={2} />
                          </tr>
                          {rows.map((row, i) => renderRow(row, i))}
                        </FragmentGroup>
                      );
                    })
                  ) : (
                    visibleRows.map((row, i) => renderRow(row, i))
                  )}
                </tbody>
                {/* 6. Totaux en bas */}
                <tfoot className="sticky bottom-0">
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold text-slate-800">
                    <td colSpan={8} className="px-2 py-2 text-[12px]">
                      {selectedRows.length > 0
                        ? `Totaux sélection (${selectedRows.length})`
                        : `Totaux liste filtrée (${visibleRows.length})`}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {num(footerTotals.totalExcludingTax, currency)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {num(footerTotals.totalVatAmount, currency)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {num(footerTotals.totalIncludingTax, currency)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-red-600">
                      {num(footerTotals.amountDue, currency)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Barre basse type Sage */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="font-medium text-slate-700">
                {visibleRows.length} / {total}
              </span>
              <span>
                Exercice {exercise.from ? `du ${formatDateShort(exercise.from)}` : ""}
                {exercise.to ? ` au ${formatDateShort(exercise.to)}` : ""}
                {!exercise.from && !exercise.to ? "—" : ""}
              </span>
              <span>Actualisé aujourd&apos;hui</span>
            </div>
            <div className="flex items-center gap-2">
              <span>
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={page <= 1}
                onClick={() => router.push(buildUrl({ page: String(page - 1) }))}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={page >= totalPages}
                onClick={() => router.push(buildUrl({ page: String(page + 1) }))}
              >
                Suivant
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
