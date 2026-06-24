"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Contact,
  Download,
  FileText,
  Folder,
  Pencil,
  Printer,
  Receipt,
  Trash2,
  UserPlus,
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
import type { CustomerGridRow } from "@/lib/customers";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort, cn } from "@/lib/utils";
import {
  archiveCustomerAction,
  exportCustomersGridCsvAction,
} from "@/server/actions/customer.actions";

type Props = {
  user: SessionUser;
  rows: CustomerGridRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: Record<string, string | undefined>;
};

const STATUS_TONE: Record<string, SageTone> = {
  ACTIVE: "green",
  PROSPECT: "blue",
  INACTIVE: "gray",
  ARCHIVED: "slate",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  PROSPECT: "Prospect",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
};

const TYPE_LABEL: Record<string, string> = {
  COMPANY: "Société",
  INDIVIDUAL: "Particulier",
};

function money(v: number, currency: string) {
  return formatCurrency(v, currency);
}

export function CustomersSageClient({
  user,
  rows,
  total,
  page,
  pageSize,
  totalPages,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const canCreate = hasPermission(user, "CUSTOMERS_CREATE");
  const canUpdate = hasPermission(user, "CUSTOMERS_UPDATE");
  const canDelete = hasPermission(user, "CUSTOMERS_DELETE");

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const single = selectedIds.size === 1 ? rowsById.get([...selectedIds][0]) ?? null : null;
  const currency = rows[0]?.currency ?? "EUR";

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    return `/customers?${params.toString()}`;
  }

  async function handleDelete() {
    if (selectedIds.size === 0 || !canDelete) return;
    if (!window.confirm(`Archiver ${selectedIds.size} client(s) sélectionné(s) ?`)) return;
    let ok = 0;
    for (const id of selectedIds) {
      const r = await archiveCustomerAction(id);
      if (r.success) ok++;
    }
    toast.success(`${ok} client(s) archivé(s)`);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleExport() {
    const result = await exportCustomersGridCsvAction(Object.fromEntries(searchParams.entries()));
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "clients.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  const columns: SageColumn<CustomerGridRow>[] = [
    {
      key: "customerNumber",
      header: "Code",
      sortable: true,
      value: (r) => r.customerNumber,
      filter: { type: "text", placeholder: "Code…" },
      render: (r) => <span className="font-mono text-[12px] text-slate-900">{r.customerNumber}</span>,
    },
    {
      key: "company",
      header: "Société",
      sortable: true,
      value: (r) => r.companyName || r.name,
      filter: { type: "text", placeholder: "Société…" },
      className: "max-w-[180px] truncate",
      render: (r) => <span className="text-slate-800" title={r.companyName}>{r.companyName || "—"}</span>,
    },
    {
      key: "name",
      header: "Nom",
      sortable: true,
      value: (r) => r.name,
      filter: { type: "text", placeholder: "Nom…" },
      className: "max-w-[160px] truncate",
      render: (r) => <span className="text-slate-700" title={r.name}>{r.name}</span>,
    },
    {
      key: "phone",
      header: "Téléphone",
      value: (r) => r.phone ?? "",
      render: (r) => <span className="text-slate-600">{r.phone || "—"}</span>,
    },
    {
      key: "email",
      header: "Email",
      value: (r) => r.email ?? "",
      filter: { type: "text", placeholder: "Email…" },
      className: "max-w-[180px] truncate",
      render: (r) => <span className="text-slate-600" title={r.email ?? ""}>{r.email || "—"}</span>,
    },
    {
      key: "city",
      header: "Ville",
      value: (r) => r.city,
      filter: { type: "text", placeholder: "Ville…" },
      render: (r) => <span className="text-slate-600">{r.city || "—"}</span>,
    },
    {
      key: "country",
      header: "Pays",
      align: "center",
      value: (r) => r.country,
      render: (r) => <span className="text-slate-500">{r.country || "—"}</span>,
    },
    {
      key: "siren",
      header: "SIREN",
      value: (r) => (r.siret ? r.siret.slice(0, 9) : ""),
      render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.siret ? r.siret.slice(0, 9) : "—"}</span>,
    },
    {
      key: "siret",
      header: "SIRET",
      value: (r) => r.siret ?? "",
      render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.siret || "—"}</span>,
    },
    {
      key: "vat",
      header: "TVA intracom.",
      value: (r) => r.vatNumber ?? "",
      render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.vatNumber || "—"}</span>,
    },
    {
      key: "invoiced",
      header: "Total facturé",
      align: "right",
      sortable: true,
      value: (r) => r.totalInvoiced,
      render: (r) => <span className="text-slate-700">{money(r.totalInvoiced, r.currency)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.totalInvoiced, 0), currency),
    },
    {
      key: "paid",
      header: "Total payé",
      align: "right",
      sortable: true,
      value: (r) => r.totalPaid,
      render: (r) => <span className="text-emerald-600">{money(r.totalPaid, r.currency)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.totalPaid, 0), currency),
    },
    {
      key: "due",
      header: "Solde dû",
      align: "right",
      sortable: true,
      value: (r) => r.balanceDue,
      render: (r) => (
        <span className={cn("font-medium", r.balanceDue > 0 ? "text-red-600" : "text-emerald-600")}>
          {money(r.balanceDue, r.currency)}
        </span>
      ),
      footer: (rs) => money(rs.reduce((s, r) => s + r.balanceDue, 0), currency),
    },
    {
      key: "lastInvoice",
      header: "Dernière facture",
      sortable: true,
      value: (r) => r.lastInvoiceDate ?? "",
      render: (r) => (
        <span className="text-slate-600">
          {r.lastInvoiceDate ? formatDateShort(r.lastInvoiceDate) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Statut",
      value: (r) => r.status,
      filter: {
        type: "select",
        options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
      },
      render: (r) => (
        <div className="flex items-center gap-1">
          <SageStatusBadge label={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? "gray"} />
          {r.overdueCount > 0 && <SageStatusBadge label={`${r.overdueCount} en retard`} tone="red" />}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Clients</h1>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Gestion commerciale — tiers clients
        </p>
      </div>

      <SageToolbar>
        <SageActionButton icon={UserPlus} label="Créer" disabled={!canCreate} onClick={() => router.push("/customers/new")} />
        <SageActionButton
          icon={Pencil}
          label="Modifier"
          disabled={!single || !canUpdate}
          onClick={() => single && router.push(`/customers/${single.id}/edit`)}
        />
        <SageActionButton
          icon={Trash2}
          label="Supprimer"
          disabled={selectedIds.size === 0 || !canDelete}
          title="Archiver les clients sélectionnés"
          onClick={handleDelete}
        />
        <SageActionButton
          icon={Contact}
          label="Ouvrir fiche"
          disabled={!single}
          onClick={() => single && router.push(`/customers/${single.id}`)}
        />
        <SageActionButton
          icon={Receipt}
          label="Factures"
          disabled={!single}
          onClick={() => single && router.push(`/invoices?customerId=${single.id}`)}
        />
        <SageActionButton
          icon={FileText}
          label="Devis"
          disabled={!single}
          onClick={() => single && router.push(`/quotes?customerId=${single.id}`)}
        />
        <SageActionButton
          icon={Wallet}
          label="Règlements"
          disabled={!single}
          onClick={() => single && router.push(`/payments?customerId=${single.id}`)}
        />
        <SageActionButton
          icon={Folder}
          label="Documents"
          disabled={!single}
          onClick={() => single && router.push(`/customers/${single.id}`)}
        />
        <SageActionButton icon={Download} label="Exporter" onClick={handleExport} />
        <SageActionButton icon={Printer} label="Imprimer" disabled={!single} onClick={() => window.print()} />
        <SageActionButton icon={X} label="Fermer" onClick={() => router.push("/dashboard")} />
      </SageToolbar>

      <SageFilterBar action="/customers">
        <SageFilterField label="Recherche" htmlFor="q">
          <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Nom, société, email…" className="h-9 w-56" />
        </SageFilterField>
        <SageFilterField label="Statut" htmlFor="status">
          <select id="status" name="status" defaultValue={filters.status ?? ""} className="h-9 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </SageFilterField>
        <SageFilterField label="Type" htmlFor="type">
          <select id="type" name="type" defaultValue={filters.type ?? ""} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </SageFilterField>
        <SageFilterField label="Ville" htmlFor="city">
          <Input id="city" name="city" defaultValue={filters.city ?? ""} className="h-9 w-32" />
        </SageFilterField>
        <SageFilterField label="Pays" htmlFor="country">
          <Input id="country" name="country" defaultValue={filters.country ?? ""} className="h-9 w-24" />
        </SageFilterField>
        <SageFilterField label="Solde" htmlFor="balance">
          <select id="balance" name="balance" defaultValue={filters.balance ?? ""} className="h-9 w-44 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            <option value="due">Avec solde dû</option>
            <option value="overdue">Factures en retard</option>
          </select>
        </SageFilterField>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="h-9">Appliquer</Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => router.push("/customers")}>
            Réinitialiser
          </Button>
        </div>
      </SageFilterBar>

      <SageDataGrid<CustomerGridRow>
        columns={columns}
        rows={rows}
        getId={(r) => r.id}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenRow={(r) => router.push(`/customers/${r.id}`)}
        searchPlaceholder="Rechercher dans la liste (nom, société, email, ville…)"
        emptyLabel="Aucun client ne correspond aux critères."
        onExport={handleExport}
        groupOptions={[
          { value: "status", label: "Par statut", keyOf: (r) => STATUS_LABEL[r.status] ?? r.status },
          { value: "city", label: "Par ville", keyOf: (r) => r.city || "—" },
          { value: "country", label: "Par pays", keyOf: (r) => r.country || "—" },
          { value: "type", label: "Par type", keyOf: (r) => TYPE_LABEL[r.type] ?? r.type },
        ]}
        bottomBar={{
          total,
          page,
          pageSize,
          totalPages,
          exerciseLabel: `${total} client(s)`,
          onPage: (p) => router.push(buildUrl({ page: String(p) })),
        }}
      />
    </div>
  );
}
