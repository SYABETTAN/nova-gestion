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
  Mail,
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
import type { QuoteGridRow } from "@/lib/quotes";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort, cn } from "@/lib/utils";
import { archiveQuoteAction, exportQuotesGridCsvAction } from "@/server/actions/quote.actions";
import { acceptQuoteAction, convertQuoteToInvoiceAction } from "@/server/actions/quote-status.actions";

type Props = {
  user: SessionUser;
  rows: QuoteGridRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  customers: { id: string; name: string }[];
  filters: Record<string, string | undefined>;
};

const STATUS_TONE: Record<string, SageTone> = {
  DRAFT: "gray",
  SENT: "blue",
  VIEWED: "sky",
  ACCEPTED: "green",
  REFUSED: "red",
  EXPIRED: "orange",
  CONVERTED: "violet",
  CANCELLED: "slate",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  VIEWED: "Consulté",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
  CONVERTED: "Transformé",
  CANCELLED: "Annulé",
};
const CRITERIA = [
  { value: "", label: "Tous les devis" },
  { value: "DRAFT", label: "Les brouillons" },
  { value: "SENT", label: "Les devis envoyés" },
  { value: "ACCEPTED", label: "Les devis acceptés" },
  { value: "REFUSED", label: "Les devis refusés" },
  { value: "EXPIRED", label: "Les devis expirés" },
  { value: "CONVERTED", label: "Les devis transformés" },
];

export function QuotesSageClient({
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

  const canCreate = hasPermission(user, "QUOTES_CREATE");
  const canUpdate = hasPermission(user, "QUOTES_UPDATE");
  const canDelete = hasPermission(user, "QUOTES_DELETE");
  const canValidate = hasPermission(user, "QUOTES_VALIDATE");
  const canCreateInvoice = hasPermission(user, "INVOICES_CREATE");

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const single = selectedIds.size === 1 ? rowsById.get([...selectedIds][0]) ?? null : null;
  const currency = rows[0]?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency);
  const year = new Date().getFullYear();
  const defaultFrom = filters.issueDateFrom ?? `${year}-01-01`;
  const defaultTo = filters.issueDateTo ?? `${year}-12-31`;

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    return `/quotes?${params.toString()}`;
  }

  async function runAction(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    const r = await fn();
    if (r.success) {
      toast.success(ok);
      router.refresh();
    } else {
      toast.error(r.error ?? "Action impossible");
    }
  }

  async function handleConvert() {
    if (!single) return;
    const r = (await convertQuoteToInvoiceAction(single.id)) as {
      success: boolean;
      error?: string;
      invoiceId?: string;
    };
    if (r.success) {
      toast.success("Devis transformé en facture");
      if (r.invoiceId) router.push(`/invoices/${r.invoiceId}`);
      else router.refresh();
    } else {
      toast.error(r.error ?? "Transformation impossible");
    }
  }

  async function handleDelete() {
    if (selectedIds.size === 0 || !canDelete) return;
    if (!window.confirm(`Archiver ${selectedIds.size} devis ?`)) return;
    let ok = 0;
    for (const id of selectedIds) {
      const r = await archiveQuoteAction(id);
      if (r.success) ok++;
    }
    toast.success(`${ok} devis archivé(s)`);
    setSelectedIds(new Set());
    router.refresh();
  }

  async function handleExport() {
    const result = await exportQuotesGridCsvAction(Object.fromEntries(searchParams.entries()));
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "devis.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  const editable = single ? ["DRAFT", "SENT", "VIEWED"].includes(single.status) : false;

  const columns: SageColumn<QuoteGridRow>[] = [
    {
      key: "number",
      header: "N° devis",
      sortable: true,
      value: (r) => r.quoteNumber,
      filter: { type: "text", placeholder: "N°…" },
      render: (r) => <span className="font-mono text-[12px] font-medium text-slate-900">{r.quoteNumber}</span>,
    },
    {
      key: "status",
      header: "Statut",
      value: (r) => r.status,
      filter: { type: "select", options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
      render: (r) => <SageStatusBadge label={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? "gray"} />,
    },
    {
      key: "issueDate",
      header: "Date",
      sortable: true,
      value: (r) => r.issueDate,
      render: (r) => <span className="text-slate-700">{formatDateShort(r.issueDate)}</span>,
    },
    {
      key: "validUntil",
      header: "Échéance",
      sortable: true,
      value: (r) => r.validUntil,
      render: (r) => <span className="text-slate-600">{formatDateShort(r.validUntil)}</span>,
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
      key: "converted",
      header: "Transformé",
      align: "center",
      value: (r) => (r.convertedToInvoice ? "yes" : "no"),
      filter: { type: "select", options: [{ value: "yes", label: "Oui" }, { value: "no", label: "Non" }] },
      render: (r) =>
        r.convertedToInvoice ? <Check className="mx-auto h-3.5 w-3.5 text-violet-600" /> : <span className="text-slate-300">—</span>,
    },
    {
      key: "country",
      header: "Pays",
      align: "center",
      value: (r) => r.country,
      render: (r) => <span className="text-slate-500">{r.country || "—"}</span>,
    },
    {
      key: "updated",
      header: "Dern. modif.",
      sortable: true,
      value: (r) => r.updatedAt,
      render: (r) => <span className="text-slate-500">{formatDateShort(r.updatedAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Devis</h1>
        <p className="text-xs text-[var(--color-muted-foreground)]">Gestion commerciale — propositions</p>
      </div>

      <SageToolbar>
        <SageActionButton icon={FilePlus2} label="Créer" disabled={!canCreate} onClick={() => router.push("/quotes/new")} />
        <SageActionButton icon={Pencil} label="Modifier" disabled={!single || !editable || !canUpdate} title={single && !editable ? "Devis non modifiable" : "Modifier"} onClick={() => single && router.push(`/quotes/${single.id}/edit`)} />
        <SageActionButton icon={Trash2} label="Supprimer" disabled={selectedIds.size === 0 || !canDelete} title="Archiver les devis sélectionnés" onClick={handleDelete} />
        <SageActionButton icon={Eye} label="Aperçu" disabled={!single} onClick={() => single && router.push(`/quotes/${single.id}`)} />
        <SageActionButton icon={Printer} label="Imprimer" disabled={!single} onClick={() => single && window.open(`/quotes/${single.id}/print`, "_blank")} />
        <SageActionButton icon={Mail} label="Envoyer" disabled={!single} title="Ouvrir le devis pour l'envoyer par email" onClick={() => single && router.push(`/quotes/${single.id}`)} />
        <SageActionButton icon={Check} label="Valider" disabled={!single || single.status !== "SENT" || !canValidate} title="Marquer le devis comme accepté" onClick={() => single && runAction(() => acceptQuoteAction(single.id), "Devis accepté")} />
        <SageActionButton icon={FileText} label="→ Facture" disabled={!single || single.convertedToInvoice || !canCreateInvoice} title={single?.convertedToInvoice ? "Déjà transformé" : "Transformer en facture"} onClick={handleConvert} />
        <SageActionButton icon={Folder} label="Documents" disabled={!single} onClick={() => single && router.push(`/quotes/${single.id}`)} />
        <SageActionButton icon={Download} label="Exporter" onClick={handleExport} />
        <SageActionButton icon={X} label="Fermer" onClick={() => router.push("/dashboard")} />
      </SageToolbar>

      <SageFilterBar action="/quotes">
        <SageFilterField label="Recherche" htmlFor="q">
          <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="N°, client, objet…" className="h-9 w-52" />
        </SageFilterField>
        <SageFilterField label="Client" htmlFor="customerId">
          <select id="customerId" name="customerId" defaultValue={filters.customerId ?? ""} className="h-9 w-48 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous les clients</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Période du" htmlFor="issueDateFrom">
          <Input id="issueDateFrom" name="issueDateFrom" type="date" defaultValue={defaultFrom} className="h-9 w-[150px]" />
        </SageFilterField>
        <SageFilterField label="au" htmlFor="issueDateTo">
          <Input id="issueDateTo" name="issueDateTo" type="date" defaultValue={defaultTo} className="h-9 w-[150px]" />
        </SageFilterField>
        <SageFilterField label="Critères" htmlFor="criteria">
          <select id="criteria" name="criteria" defaultValue={filters.criteria ?? ""} className="h-9 w-52 rounded-md border border-slate-300 bg-white px-2 text-sm">
            {CRITERIA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </SageFilterField>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="h-9">Appliquer</Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => router.push("/quotes")}>Réinitialiser</Button>
        </div>
      </SageFilterBar>

      <SageDataGrid<QuoteGridRow>
        columns={columns}
        rows={rows}
        getId={(r) => r.id}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenRow={(r) => router.push(`/quotes/${r.id}`)}
        searchPlaceholder="Rechercher dans la liste (n°, client, société…)"
        emptyLabel="Aucun devis ne correspond aux critères."
        onExport={handleExport}
        groupOptions={[
          { value: "status", label: "Par statut", keyOf: (r) => STATUS_LABEL[r.status] ?? r.status },
          { value: "customer", label: "Par client", keyOf: (r) => r.companyName || r.customerName },
          { value: "month", label: "Par mois", keyOf: (r) => new Date(r.issueDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) },
        ]}
        bottomBar={{
          total,
          page,
          pageSize,
          totalPages,
          exerciseLabel: `Exercice ${year} · ${total} devis`,
          onPage: (p) => router.push(buildUrl({ page: String(p) })),
        }}
      />
    </div>
  );
}
