"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Folder,
  Paperclip,
  Pencil,
  Printer,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SageToolbar, SageActionButton } from "@/components/sage/sage-toolbar";
import { SageStatusBadge, type SageTone } from "@/components/sage/sage-status-badge";
import { SageFilterBar, SageFilterField } from "@/components/sage/sage-filter-bar";
import { SageDataGrid, type SageColumn } from "@/components/sage/sage-list-page";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import type { SupplierInvoiceGridRow } from "@/lib/supplier-invoices";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort, cn } from "@/lib/utils";
import {
  archiveSupplierInvoiceAction,
  exportSupplierInvoicesGridCsvAction,
} from "@/server/actions/supplier-invoice.actions";

type Props = {
  user: SessionUser;
  rows: SupplierInvoiceGridRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  suppliers: { id: string; name: string }[];
  filters: Record<string, string | undefined>;
};

function displayStatus(row: SupplierInvoiceGridRow): { label: string; tone: SageTone; key: string } {
  if (row.status === "DRAFT") return { label: "Brouillon", tone: "gray", key: "draft" };
  if (row.status === "CANCELLED" || row.status === "ARCHIVED")
    return { label: "Annulée", tone: "slate", key: "cancelled" };
  if (row.paymentStatus === "PAID" || row.amountDue <= 0)
    return { label: "Payée", tone: "green", key: "paid" };
  if (row.paymentStatus === "PARTIALLY_PAID")
    return { label: "Part. payée", tone: "orange", key: "partial" };
  if (row.amountDue > 0) return { label: "À payer", tone: "red", key: "topay" };
  return { label: "Validée", tone: "blue", key: "validated" };
}

export function SupplierInvoicesSageClient({
  user,
  rows,
  total,
  page,
  pageSize,
  totalPages,
  suppliers,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const canCreate = hasPermission(user, "SUPPLIER_INVOICES_CREATE");
  const canUpdate = hasPermission(user, "SUPPLIER_INVOICES_UPDATE");

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const single = selectedIds.size === 1 ? rowsById.get([...selectedIds][0]) ?? null : null;
  const currency = rows[0]?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency);
  const year = new Date().getFullYear();

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    return `/supplier-invoices?${params.toString()}`;
  }

  async function handleDelete() {
    if (selectedIds.size === 0 || !canUpdate) return;
    if (!window.confirm(`Archiver ${selectedIds.size} facture(s) fournisseur ?`)) return;
    let ok = 0;
    for (const id of selectedIds) {
      const r = await archiveSupplierInvoiceAction(id);
      if (r.success) ok++;
    }
    toast.success(`${ok} facture(s) archivée(s)`);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleExport() {
    const result = await exportSupplierInvoicesGridCsvAction(Object.fromEntries(searchParams.entries()));
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "factures-fournisseurs.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  const columns: SageColumn<SupplierInvoiceGridRow>[] = [
    {
      key: "number",
      header: "N° facture",
      sortable: true,
      value: (r) => r.supplierInvoiceNumber,
      filter: { type: "text", placeholder: "N°…" },
      render: (r) => <span className="font-mono text-[12px] font-medium text-slate-900">{r.supplierInvoiceNumber}</span>,
    },
    {
      key: "status",
      header: "Statut",
      value: (r) => displayStatus(r).key,
      filter: {
        type: "select",
        options: [
          { value: "draft", label: "Brouillon" },
          { value: "validated", label: "Validée" },
          { value: "topay", label: "À payer" },
          { value: "partial", label: "Part. payée" },
          { value: "paid", label: "Payée" },
          { value: "cancelled", label: "Annulée" },
        ],
      },
      render: (r) => {
        const s = displayStatus(r);
        return <SageStatusBadge label={s.label} tone={s.tone} />;
      },
    },
    {
      key: "accounted",
      header: "Compta.",
      align: "center",
      value: () => "",
      render: () => <span className="text-slate-300" title="Comptabilisation non disponible">—</span>,
    },
    {
      key: "issueDate",
      header: "Date facture",
      sortable: true,
      value: (r) => r.issueDate,
      render: (r) => <span className="text-slate-700">{formatDateShort(r.issueDate)}</span>,
    },
    {
      key: "dueDate",
      header: "Échéance",
      sortable: true,
      value: (r) => r.dueDate,
      render: (r) => (
        <span className={cn(r.isOverdue ? "font-medium text-red-600" : "text-slate-600")}>{formatDateShort(r.dueDate)}</span>
      ),
    },
    {
      key: "supplier",
      header: "Fournisseur",
      sortable: true,
      value: (r) => r.supplierName,
      filter: { type: "text", placeholder: "Fournisseur…" },
      className: "max-w-[170px] truncate",
      render: (r) => <span className="text-slate-800" title={r.supplierName}>{r.supplierName}</span>,
    },
    {
      key: "company",
      header: "Société",
      value: (r) => r.companyName,
      className: "max-w-[150px] truncate",
      render: (r) => <span className="text-slate-600" title={r.companyName}>{r.companyName || "—"}</span>,
    },
    {
      key: "ht",
      header: "Total HT",
      align: "right",
      sortable: true,
      value: (r) => r.totalExcludingTax,
      render: (r) => <span className="text-slate-700">{money(r.totalExcludingTax)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.totalExcludingTax, 0)),
    },
    {
      key: "vat",
      header: "Total TVA",
      align: "right",
      value: (r) => r.totalVatAmount,
      render: (r) => <span className="text-slate-600">{money(r.totalVatAmount)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.totalVatAmount, 0)),
    },
    {
      key: "ttc",
      header: "Total TTC",
      align: "right",
      sortable: true,
      value: (r) => r.totalIncludingTax,
      render: (r) => <span className="font-medium text-slate-900">{money(r.totalIncludingTax)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.totalIncludingTax, 0)),
    },
    {
      key: "paid",
      header: "Déjà payé",
      align: "right",
      value: (r) => r.amountPaid,
      render: (r) => <span className="text-emerald-600">{money(r.amountPaid)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.amountPaid, 0)),
    },
    {
      key: "due",
      header: "Solde dû",
      align: "right",
      sortable: true,
      value: (r) => r.amountDue,
      render: (r) => (
        <span className={cn("font-medium", r.amountDue > 0 ? "text-red-600" : "text-emerald-600")}>{money(r.amountDue)}</span>
      ),
      footer: (rs) => money(rs.reduce((s, r) => s + r.amountDue, 0)),
    },
    {
      key: "country",
      header: "Pays",
      align: "center",
      value: (r) => r.country,
      render: (r) => <span className="text-slate-500">{r.country || "—"}</span>,
    },
    {
      key: "pdf",
      header: "PDF",
      align: "center",
      value: (r) => (r.hasPdf ? "yes" : "no"),
      render: (r) => (r.hasPdf ? <Paperclip className="mx-auto h-3.5 w-3.5 text-slate-600" /> : <span className="text-slate-300">—</span>),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Factures fournisseurs</h1>
        <p className="text-xs text-[var(--color-muted-foreground)]">Achats — pièces fournisseurs</p>
      </div>

      <SageToolbar>
        <SageActionButton icon={FilePlus2} label="Créer" disabled={!canCreate} onClick={() => router.push("/supplier-invoices/new")} />
        <SageActionButton icon={Pencil} label="Modifier" disabled={!single || single.status !== "DRAFT" || !canUpdate} title={single && single.status !== "DRAFT" ? "Seules les factures provisoires sont modifiables" : "Modifier"} onClick={() => single && router.push(`/supplier-invoices/${single.id}/edit`)} />
        <SageActionButton icon={Trash2} label="Supprimer" disabled={selectedIds.size === 0 || !canUpdate} title="Archiver les factures sélectionnées" onClick={handleDelete} />
        <SageActionButton icon={Eye} label="Aperçu" disabled={!single} onClick={() => single && router.push(`/supplier-invoices/${single.id}`)} />
        <SageActionButton icon={Printer} label="Imprimer" disabled={!single} onClick={() => single && window.open(`/supplier-invoices/${single.id}/print`, "_blank")} />
        <SageActionButton icon={Check} label="Valider" disabled={!single || single.status !== "DRAFT" || !canUpdate} title="Valider la facture depuis sa fiche" onClick={() => single && router.push(`/supplier-invoices/${single.id}`)} />
        <SageActionButton icon={Wallet} label="Régler" disabled title="Règlement fournisseur — bientôt disponible" />
        <SageActionButton icon={Folder} label="Documents" disabled={!single} onClick={() => single && router.push(`/supplier-invoices/${single.id}`)} />
        <SageActionButton icon={Download} label="Exporter" onClick={handleExport} />
        <SageActionButton icon={FileText} label="Ouvrir" disabled={!single} onClick={() => single && router.push(`/supplier-invoices/${single.id}`)} />
        <SageActionButton icon={X} label="Fermer" onClick={() => router.push("/dashboard")} />
      </SageToolbar>

      <SageFilterBar action="/supplier-invoices">
        <SageFilterField label="Recherche" htmlFor="q">
          <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="N°, fournisseur…" className="h-9 w-52" />
        </SageFilterField>
        <SageFilterField label="Fournisseur" htmlFor="supplierId">
          <select id="supplierId" name="supplierId" defaultValue={filters.supplierId ?? ""} className="h-9 w-48 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous les fournisseurs</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Statut" htmlFor="status">
          <select id="status" name="status" defaultValue={filters.status ?? ""} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            <option value="DRAFT">Brouillon</option>
            <option value="VALIDATED">Validée</option>
          </select>
        </SageFilterField>
        <SageFilterField label="Paiement" htmlFor="paymentStatus">
          <select id="paymentStatus" name="paymentStatus" defaultValue={filters.paymentStatus ?? ""} className="h-9 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            <option value="UNPAID">Non payée</option>
            <option value="PARTIALLY_PAID">Part. payée</option>
            <option value="PAID">Payée</option>
            <option value="OVERDUE">Échue</option>
          </select>
        </SageFilterField>
        <SageFilterField label="Échéance" htmlFor="overdue">
          <select id="overdue" name="overdue" defaultValue={filters.overdue ?? ""} className="h-9 w-32 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Toutes</option>
            <option value="true">Échues</option>
          </select>
        </SageFilterField>
        <SageFilterField label="Période du" htmlFor="issueDateFrom">
          <Input id="issueDateFrom" name="issueDateFrom" type="date" defaultValue={filters.issueDateFrom ?? ""} className="h-9 w-[150px]" />
        </SageFilterField>
        <SageFilterField label="au" htmlFor="issueDateTo">
          <Input id="issueDateTo" name="issueDateTo" type="date" defaultValue={filters.issueDateTo ?? ""} className="h-9 w-[150px]" />
        </SageFilterField>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="h-9">Appliquer</Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => router.push("/supplier-invoices")}>Réinitialiser</Button>
        </div>
      </SageFilterBar>

      <SageDataGrid<SupplierInvoiceGridRow>
        columns={columns}
        rows={rows}
        getId={(r) => r.id}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenRow={(r) => router.push(`/supplier-invoices/${r.id}`)}
        searchPlaceholder="Rechercher dans la liste (n°, fournisseur, société…)"
        emptyLabel="Aucune facture fournisseur ne correspond aux critères."
        onExport={handleExport}
        groupOptions={[
          { value: "supplier", label: "Par fournisseur", keyOf: (r) => r.companyName || r.supplierName },
          { value: "status", label: "Par statut", keyOf: (r) => displayStatus(r).label },
          { value: "month", label: "Par mois", keyOf: (r) => new Date(r.issueDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) },
        ]}
        bottomBar={{
          total,
          page,
          pageSize,
          totalPages,
          exerciseLabel: `Exercice ${year} · ${total} facture(s)`,
          onPage: (p) => router.push(buildUrl({ page: String(p) })),
        }}
      />
    </div>
  );
}
