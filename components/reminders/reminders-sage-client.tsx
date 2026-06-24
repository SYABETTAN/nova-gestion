"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  Contact,
  Download,
  Printer,
  Receipt,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SageToolbar, SageActionButton } from "@/components/sage/sage-toolbar";
import { SageStatusBadge, type SageTone } from "@/components/sage/sage-status-badge";
import { SageFilterBar, SageFilterField } from "@/components/sage/sage-filter-bar";
import { SageDataGrid, type SageColumn } from "@/components/sage/sage-list-page";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import type { ReminderGridRow } from "@/lib/reminders";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort, cn } from "@/lib/utils";
import {
  exportRemindersGridCsvAction,
  getInvoiceReminderPreviewAction,
  sendBulkReminderEmailAction,
  sendReminderEmailAction,
} from "@/server/actions/reminder.actions";

type Props = {
  user: SessionUser;
  rows: ReminderGridRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  customers: { id: string; name: string }[];
  filters: Record<string, string | undefined>;
};

const LEVEL_TONE: Record<string, SageTone> = {
  FRIENDLY: "blue",
  FIRST_NOTICE: "amber",
  SECOND_NOTICE: "orange",
  FINAL_NOTICE: "red",
};
const LEVEL_LABEL: Record<string, string> = {
  FRIENDLY: "Amiable",
  FIRST_NOTICE: "1re relance",
  SECOND_NOTICE: "2e relance",
  FINAL_NOTICE: "Dernière",
};
const STATUS_TONE: Record<string, SageTone> = {
  NONE: "gray",
  TO_REMIND: "red",
  REMINDED: "orange",
  PAUSED: "slate",
  DISPUTED: "violet",
};
const STATUS_LABEL: Record<string, string> = {
  NONE: "À relancer",
  TO_REMIND: "À relancer",
  REMINDED: "Relancée",
  PAUSED: "Suspendue",
  DISPUTED: "En litige",
};

export function RemindersSageClient({
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
  const [busy, setBusy] = useState(false);

  const canSend = hasPermission(user, "REMINDERS_SEND");

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.invoiceId, r])), [rows]);
  const single = selectedIds.size === 1 ? rowsById.get([...selectedIds][0]) ?? null : null;
  const currency = rows[0]?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency);

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    return `/reminders?${params.toString()}`;
  }

  async function sendOne(invoiceId: string) {
    setBusy(true);
    try {
      const preview = await getInvoiceReminderPreviewAction(invoiceId);
      if (!preview) {
        toast.error("Aperçu de relance indisponible");
        return;
      }
      if (!preview.eligible) {
        toast.error("Facture non éligible à la relance");
        return;
      }
      if (!preview.subject || !preview.message) {
        toast.error("Aucun modèle de relance configuré pour ce niveau");
        return;
      }
      const r = await sendReminderEmailAction({
        invoiceId,
        recipientEmail: preview.recipientEmail,
        level: preview.level,
        channel: "EMAIL",
        subject: preview.subject,
        message: preview.message,
        includePaymentLinkPlaceholder: true,
      });
      if (r.success) {
        toast.success("Relance envoyée");
        router.refresh();
      } else {
        toast.error(r.error ?? "Envoi impossible");
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendBulk() {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      const r = (await sendBulkReminderEmailAction({ invoiceIds: [...selectedIds].slice(0, 20) })) as {
        success: boolean;
        error?: string;
        created?: number;
        ignored?: number;
      };
      if (r.success) {
        toast.success(`${r.created ?? 0} relance(s) générée(s)${r.ignored ? `, ${r.ignored} ignorée(s)` : ""}`);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(r.error ?? "Génération impossible");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    const result = await exportRemindersGridCsvAction(Object.fromEntries(searchParams.entries()));
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "relances.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  const columns: SageColumn<ReminderGridRow>[] = [
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
      header: "Facture",
      sortable: true,
      value: (r) => r.invoiceNumber,
      filter: { type: "text", placeholder: "N°…" },
      render: (r) => <span className="font-mono text-[12px] font-medium text-slate-900">{r.invoiceNumber}</span>,
    },
    {
      key: "issueDate",
      header: "Date facture",
      sortable: true,
      value: (r) => r.issueDate,
      render: (r) => <span className="text-slate-600">{formatDateShort(r.issueDate)}</span>,
    },
    {
      key: "dueDate",
      header: "Échéance",
      sortable: true,
      value: (r) => r.dueDate,
      render: (r) => <span className="text-slate-700">{formatDateShort(r.dueDate)}</span>,
    },
    {
      key: "days",
      header: "Jours retard",
      align: "right",
      sortable: true,
      value: (r) => r.daysOverdue,
      render: (r) => <span className="font-medium tabular-nums text-red-600">{r.daysOverdue}</span>,
    },
    {
      key: "ttc",
      header: "Total TTC",
      align: "right",
      sortable: true,
      value: (r) => r.totalIncludingTax,
      render: (r) => <span className="text-slate-700">{money(r.totalIncludingTax)}</span>,
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
      render: (r) => <span className="font-medium text-red-600">{money(r.amountDue)}</span>,
      footer: (rs) => money(rs.reduce((s, r) => s + r.amountDue, 0)),
    },
    {
      key: "level",
      header: "Niveau",
      value: (r) => r.reminderLevel,
      filter: { type: "select", options: Object.entries(LEVEL_LABEL).map(([value, label]) => ({ value, label })) },
      render: (r) => <SageStatusBadge label={LEVEL_LABEL[r.reminderLevel] ?? r.reminderLevel} tone={LEVEL_TONE[r.reminderLevel] ?? "gray"} />,
    },
    {
      key: "lastReminder",
      header: "Dernière relance",
      sortable: true,
      value: (r) => r.lastReminderAt ?? "",
      render: (r) => <span className="text-slate-500">{r.lastReminderAt ? formatDateShort(r.lastReminderAt) : "—"}</span>,
    },
    {
      key: "status",
      header: "Statut",
      value: (r) => r.reminderStatus,
      filter: { type: "select", options: [
        { value: "TO_REMIND", label: "À relancer" },
        { value: "REMINDED", label: "Relancée" },
        { value: "PAUSED", label: "Suspendue" },
        { value: "DISPUTED", label: "En litige" },
      ] },
      render: (r) => <SageStatusBadge label={STATUS_LABEL[r.reminderStatus] ?? r.reminderStatus} tone={STATUS_TONE[r.reminderStatus] ?? "gray"} />,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Relances</h1>
        <p className="text-xs text-[var(--color-muted-foreground)]">Factures échues à relancer</p>
      </div>

      <SageToolbar>
        <SageActionButton icon={BellRing} label="Générer relance" disabled={selectedIds.size === 0 || !canSend || busy} title="Générer/envoyer les relances pour la sélection" onClick={sendBulk} />
        <SageActionButton icon={Send} label="Envoyer relance" disabled={!single || !canSend || busy} onClick={() => single && sendOne(single.invoiceId)} />
        <SageActionButton icon={Bell} label="Marquer relancé" disabled title="L'envoi d'une relance marque automatiquement la facture comme relancée" />
        <SageActionButton icon={Receipt} label="Ouvrir facture" disabled={!single} onClick={() => single && router.push(`/invoices/${single.invoiceId}`)} />
        <SageActionButton icon={Contact} label="Ouvrir client" disabled={!single} onClick={() => single && router.push(`/customers/${single.customerId}`)} />
        <SageActionButton icon={Download} label="Exporter" onClick={handleExport} />
        <SageActionButton icon={Printer} label="Imprimer" disabled={!single} onClick={() => window.print()} />
        <SageActionButton icon={X} label="Fermer" onClick={() => router.push("/dashboard")} />
      </SageToolbar>

      <SageFilterBar action="/reminders">
        <SageFilterField label="Recherche" htmlFor="q">
          <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="N° facture, client…" className="h-9 w-52" />
        </SageFilterField>
        <SageFilterField label="Client" htmlFor="customerId">
          <select id="customerId" name="customerId" defaultValue={filters.customerId ?? ""} className="h-9 w-48 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous les clients</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Niveau" htmlFor="level">
          <select id="level" name="level" defaultValue={filters.level ?? ""} className="h-9 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tous</option>
            {Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </SageFilterField>
        <SageFilterField label="Retard min. (j)" htmlFor="daysOverdueMin">
          <Input id="daysOverdueMin" name="daysOverdueMin" type="number" min={0} defaultValue={filters.daysOverdueMin ?? ""} className="h-9 w-28" />
        </SageFilterField>
        <SageFilterField label="Montant min." htmlFor="amountMin">
          <Input id="amountMin" name="amountMin" type="number" min={0} defaultValue={filters.amountMin ?? ""} className="h-9 w-28" />
        </SageFilterField>
        <SageFilterField label="Relancées" htmlFor="reminded">
          <select id="reminded" name="reminded" defaultValue={filters.reminded ?? ""} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Toutes</option>
            <option value="false">Jamais relancées</option>
            <option value="true">Déjà relancées</option>
          </select>
        </SageFilterField>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="h-9">Appliquer</Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => router.push("/reminders")}>Réinitialiser</Button>
        </div>
      </SageFilterBar>

      <SageDataGrid<ReminderGridRow>
        columns={columns}
        rows={rows}
        getId={(r) => r.invoiceId}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenRow={(r) => router.push(`/invoices/${r.invoiceId}`)}
        searchPlaceholder="Rechercher dans la liste (facture, client, société…)"
        emptyLabel="Aucune facture à relancer."
        onExport={handleExport}
        groupOptions={[
          { value: "customer", label: "Par client", keyOf: (r) => r.companyName || r.customerName },
          { value: "level", label: "Par niveau", keyOf: (r) => LEVEL_LABEL[r.reminderLevel] ?? r.reminderLevel },
          { value: "status", label: "Par statut", keyOf: (r) => STATUS_LABEL[r.reminderStatus] ?? r.reminderStatus },
        ]}
        bottomBar={{
          total,
          page,
          pageSize,
          totalPages,
          exerciseLabel: `${total} facture(s) à relancer`,
          onPage: (p) => router.push(buildUrl({ page: String(p) })),
        }}
      />
    </div>
  );
}
