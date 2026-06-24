"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Contact,
  Download,
  Link2,
  Pencil,
  Printer,
  Receipt,
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
import type { PaymentGridRow } from "@/lib/payments";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort, cn } from "@/lib/utils";
import { exportPaymentsGridCsvAction } from "@/server/actions/payment.actions";

type Props = {
  user: SessionUser;
  rows: PaymentGridRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  customers: { id: string; name: string }[];
  filters: Record<string, string | undefined>;
};

const STATUS_TONE: Record<string, SageTone> = {
  DRAFT: "gray",
  CONFIRMED: "blue",
  PARTIALLY_ALLOCATED: "orange",
  FULLY_ALLOCATED: "green",
  CANCELLED: "slate",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmé",
  PARTIALLY_ALLOCATED: "Part. affecté",
  FULLY_ALLOCATED: "Affecté",
  CANCELLED: "Annulé",
};
const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Virement",
  CARD: "Carte",
  CHECK: "Chèque",
  CASH: "Espèces",
  DIRECT_DEBIT: "Prélèvement",
  OTHER: "Autre",
};

export function PaymentsSageClient({
  user,
  rows,
  total,
  page,
  pageSize,
  totalPages,
  customers,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const canCreate = hasPermission(user, "PAYMENTS_CREATE");
  const canUpdate = hasPermission(user, "PAYMENTS_UPDATE");

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const single = selectedIds.size === 1 ? rowsById.get([...selectedIds][0]) ?? null : null;
  const currency = rows[0]?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency);

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    return `/payments?${params.toString()}`;
  }

  async function handleExport() {
    const result = await exportPaymentsGridCsvAction(Object.fromEntries(searchParams.entries()));
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "reglements.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  const columns: SageColumn<PaymentGridRow>[] = [
    {
      key: "number",
      header: "N° règlement",
      sortable: true,
      value: (r) => r.paymentNumber,
      filter: { type: "text", placeholder: "N°…" },
      render: (r) => <span className="font-mono text-[12px] font-medium text-slate-900">{r.paymentNumber}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      value: (r) => r.paymentDate,
      render: (r) => <span className="text-slate-700">{formatDateShort(r.paymentDate)}</span>,
    },
    {
      key: "customer",
      header: "Client",
      sortable: true,
      value: (r) => r.customerName,
      filter: { type: "text", placeholder: "Client…" },
      className: "max-w-[170px] truncate",
      render: (r) => <span className="text-slate-800" title={r.customerName}>{r.customerName}</span>,
    },
    {
      key: "company",
      header: "Société",
      value: (r) => r.companyName,
      className: "max-w-[150px] truncate",
      render: (r) => <span className="text-slate-600" title={r.companyName}>{r.companyName || "—"}</span>,
    },
    {
      key: "invoice",
      header: "Facture liée",
      value: (r) => r.linkedInvoices,
      filter: { type: "text", placeholder: "Facture…" },
      className: "max-w-[150px] truncate",
      render: (r) => <span className="font-mono text-[11px] text-slate-600" title={r.linkedInvoices}>{r.linkedInvoices || "—"}</span>,
    },
    {
      key: "method",
      header: "Mode",
      value: (r) => r.method,
      filter: { type: "select", options: Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label })) },
      render: (r) => <span className="text-slate-600">{METHOD_LABEL[r.method] ?? r.method}</span>,
    },
    {
      key: "amount",
      header: "Montant",
      align: "right",
      sortable: true,
      value: (r) => r.amount,
      render: (r) => <span className="font-medium text-slate-900">{money(r.amount)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.amount, 0)),
    },
    {
      key: "allocated",
      header: "Affecté",
      align: "right",
      sortable: true,
      value: (r) => r.allocatedAmount,
      render: (r) => <span className="text-emerald-600">{money(r.allocatedAmount)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.allocatedAmount, 0)),
    },
    {
      key: "unallocated",
      header: "Reste à affecter",
      align: "right",
      sortable: true,
      value: (r) => r.unallocatedAmount,
      render: (r) => (
        <span className={cn("font-medium", r.unallocatedAmount > 0 ? "text-orange-600" : "text-slate-500")}>
          {money(r.unallocatedAmount)}
        </span>
      ),
      footer: (rs) => money(rs.reduce((s, r) => s + r.unallocatedAmount, 0)),
    },
    {
      key: "status",
      header: "Statut",
      value: (r) => r.status,
      filter: { type: "select", options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
      render: (r) => <SageStatusBadge label={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? "gray"} />,
    },
    {
      key: "bankref",
      header: "Réf. bancaire",
      value: (r) => r.bankReference ?? "",
      render: (r) => <span className="text-slate-500">{r.bankReference || "—"}</span>,
    },
    {
      key: "notes",
      header: "Notes",
      value: (r) => r.notes ?? "",
      className: "max-w-[160px] truncate",
      render: (r) => <span className="text-slate-500" title={r.notes ?? ""}>{r.notes || "—"}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Règlements</h1>
        <p className="text-xs text-[var(--color-muted-foreground)]">Encaissements clients et affectations</p>
      </div>

      <SageToolbar>
        <SageActionButton icon={Wallet} label="Créer" disabled={!canCreate} onClick={() => router.push("/payments/new")} />
        <SageActionButton icon={Pencil} label="Modifier" disabled={!single || single.status === "CANCELLED" || !canUpdate} onClick={() => single && router.push(`/payments/${single.id}/edit`)} />
        <SageActionButton icon={Trash2} label="Supprimer" disabled title="Suppression non disponible — annulez le règlement depuis sa fiche" />
        <SageActionButton icon={Link2} label="Affecter" disabled={!single} title="Affecter à une facture" onClick={() => single && router.push(`/payments/${single.id}`)} />
        <SageActionButton icon={Receipt} label="Imprimer reçu" disabled={!single} onClick={() => single && window.open(`/payments/${single.id}/receipt`, "_blank")} />
        <SageActionButton icon={Download} label="Exporter" onClick={handleExport} />
        <SageActionButton icon={Receipt} label="Ouvrir facture" disabled={!single || !single.firstInvoiceId} onClick={() => single?.firstInvoiceId && router.push(`/invoices/${single.firstInvoiceId}`)} />
        <SageActionButton icon={Contact} label="Ouvrir client" disabled={!single || !single.customerId} onClick={() => single?.customerId && router.push(`/customers/${single.customerId}`)} />
        <SageActionButton icon={Printer} label="Imprimer" disabled={!single} onClick={() => window.print()} />
        <SageActionButton icon={X} label="Fermer" onClick={() => router.push("/dashboard")} />
      </SageToolbar>

      <SageFilterBar action="/payments">
        <SageFilterField label="Recherche" htmlFor="q">
          <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="N°, client, référence…" className="h-9 w-52" />
        </SageFilterField>
        <SageFilterField label="Client" htmlFor="customerId">
          <select id="customerId" name="customerId" defaultValue={filters.customerId ?? ""} className="h-9 w-48 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous les clients</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Mode" htmlFor="method">
          <select id="method" name="method" defaultValue={filters.method ?? ""} className="h-9 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Statut" htmlFor="status">
          <select id="status" name="status" defaultValue={filters.status ?? ""} className="h-9 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Affectation" htmlFor="unallocated">
          <select id="unallocated" name="unallocated" defaultValue={filters.unallocated ?? ""} className="h-9 w-44 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            <option value="true">Non affectés</option>
          </select>
        </SageFilterField>
        <SageFilterField label="Période du" htmlFor="paymentDateFrom">
          <Input id="paymentDateFrom" name="paymentDateFrom" type="date" defaultValue={filters.paymentDateFrom ?? ""} className="h-9 w-[150px]" />
        </SageFilterField>
        <SageFilterField label="au" htmlFor="paymentDateTo">
          <Input id="paymentDateTo" name="paymentDateTo" type="date" defaultValue={filters.paymentDateTo ?? ""} className="h-9 w-[150px]" />
        </SageFilterField>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="h-9">Appliquer</Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => router.push("/payments")}>Réinitialiser</Button>
        </div>
      </SageFilterBar>

      <SageDataGrid<PaymentGridRow>
        columns={columns}
        rows={rows}
        getId={(r) => r.id}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenRow={(r) => router.push(`/payments/${r.id}`)}
        searchPlaceholder="Rechercher dans la liste (n°, client, facture, référence…)"
        emptyLabel="Aucun règlement ne correspond aux critères."
        onExport={handleExport}
        groupOptions={[
          { value: "status", label: "Par statut", keyOf: (r) => STATUS_LABEL[r.status] ?? r.status },
          { value: "method", label: "Par mode", keyOf: (r) => METHOD_LABEL[r.method] ?? r.method },
          { value: "customer", label: "Par client", keyOf: (r) => r.companyName || r.customerName },
          { value: "month", label: "Par mois", keyOf: (r) => new Date(r.paymentDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) },
        ]}
        bottomBar={{
          total,
          page,
          pageSize,
          totalPages,
          exerciseLabel: `${total} règlement(s)`,
          onPage: (p) => router.push(buildUrl({ page: String(p) })),
        }}
      />
    </div>
  );
}
