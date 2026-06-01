"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionGate } from "@/components/shared/permission-gate";
import { AccountingBalancedBadge, AccountingEntrySourceBadge, AccountingEntryStatusBadge } from "@/components/accounting/accounting-badges";
import { formatCurrency } from "@/lib/pricing";
import { ACCOUNTING_SOURCE_LABELS } from "@/lib/accounting-mapping";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import {
  cancelAccountingEntryAction,
  duplicateAccountingEntryAction,
  validateAccountingEntryAction,
} from "@/server/actions/accounting-entry.actions";
import { exportAccountingEntriesCsvAction } from "@/server/actions/accounting-report.actions";
import { generateMissingAccountingEntriesAction } from "@/server/actions/accounting-generator.actions";

type Entry = {
  id: string;
  entryNumber: string;
  entryDate: Date;
  label: string;
  sourceType: string;
  sourceLabel: string | null;
  totalDebit: MoneyInput;
  totalCredit: MoneyInput;
  isBalanced: boolean;
  status: string;
  journal: { code: string; name: string };
};

type Props = {
  user: SessionUser;
  entries: Entry[];
  total: number;
  page: number;
  pageSize: number;
  journals: { id: string; code: string; name: string }[];
  filters: Record<string, string | undefined>;
};

export function AccountingEntriesPageClient({ user, entries, total, page, pageSize, journals, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    return `/accounting/entries?${params.toString()}`;
  }

  async function handleValidate(id: string) {
    const result = await validateAccountingEntryAction(id);
    if (result.success) { toast.success("Écriture validée"); router.refresh(); }
    else toast.error(result.error ?? "Erreur");
  }

  async function handleDuplicate(id: string) {
    const result = await duplicateAccountingEntryAction(id);
    if (result.success && result.entryId) {
      toast.success("Écriture dupliquée");
      router.push(`/accounting/entries/${result.entryId}`);
    } else toast.error(result.error ?? "Erreur");
  }

  async function handleCancel(id: string) {
    const reason = prompt("Raison de l'annulation :");
    if (!reason) return;
    const result = await cancelAccountingEntryAction(id, reason);
    if (result.success) { toast.success("Écriture annulée"); router.refresh(); }
    else toast.error(result.error ?? "Erreur");
  }

  async function handleExport() {
    const result = await exportAccountingEntriesCsvAction(filters);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "ecritures.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    }
  }

  async function handleGenerateMissing() {
    const result = await generateMissingAccountingEntriesAction();
    if (result.success) {
      toast.success(`${result.created} écritures créées`);
      router.refresh();
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Écritures comptables</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Brouillard et écritures validées.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGate user={user} permission="ACCOUNTING_EXPORT">
            <Button variant="outline" onClick={handleExport}>Exporter CSV</Button>
          </PermissionGate>
          <PermissionGate user={user} permission="ACCOUNTING_CREATE">
            <Button variant="outline" onClick={handleGenerateMissing}>Générer manquantes</Button>
            <Button asChild><Link href="/accounting/entries/new">Nouvelle écriture OD</Link></Button>
          </PermissionGate>
        </div>
      </div>


      <form method="get" className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-5">
        <Input name="q" placeholder="Recherche..." defaultValue={filters.q} />
        <Select name="status" defaultValue={filters.status ?? "all"}>
          <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="DRAFT">Brouillon</SelectItem>
            <SelectItem value="VALIDATED">Validée</SelectItem>
            <SelectItem value="CANCELLED">Annulée</SelectItem>
          </SelectContent>
        </Select>
        <Select name="journalId" defaultValue={filters.journalId ?? "all"}>
          <SelectTrigger><SelectValue placeholder="Journal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous journaux</SelectItem>
            {journals.map((j) => (
              <SelectItem key={j.id} value={j.id}>{j.code} — {j.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="sourceType" defaultValue={filters.sourceType ?? "all"}>
          <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sources</SelectItem>
            {Object.entries(ACCOUNTING_SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit">Filtrer</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Numéro</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Journal</th>
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-left">Libellé</th>
              <th className="px-4 py-2 text-right">Débit</th>
              <th className="px-4 py-2 text-right">Crédit</th>
              <th className="px-4 py-2 text-left">Statut</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-[var(--color-muted-foreground)]">Aucune écriture comptable.</td></tr>
            ) : entries.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{e.entryNumber}</td>
                <td className="px-4 py-2">{formatDateShort(e.entryDate)}</td>
                <td className="px-4 py-2">{e.journal.code}</td>
                <td className="px-4 py-2"><AccountingEntrySourceBadge sourceType={e.sourceType} /></td>
                <td className="px-4 py-2">{e.label}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(e.totalDebit)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(e.totalCredit)}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    <AccountingEntryStatusBadge status={e.status} />
                    <AccountingBalancedBadge isBalanced={e.isBalanced} />
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild><Link href={`/accounting/entries/${e.id}`}>Voir</Link></Button>
                    {e.status === "DRAFT" && (
                      <PermissionGate user={user} permission="ACCOUNTING_UPDATE">
                        <Button variant="ghost" size="sm" asChild><Link href={`/accounting/entries/${e.id}/edit`}>Modifier</Link></Button>
                      </PermissionGate>
                    )}
                    {e.status === "DRAFT" && e.isBalanced && (
                      <PermissionGate user={user} permission="ACCOUNTING_VALIDATE">
                        <Button variant="ghost" size="sm" onClick={() => handleValidate(e.id)}>Valider</Button>
                      </PermissionGate>
                    )}
                    <PermissionGate user={user} permission="ACCOUNTING_CREATE">
                      <Button variant="ghost" size="sm" onClick={() => handleDuplicate(e.id)}>Dupliquer</Button>
                    </PermissionGate>
                    {e.status !== "CANCELLED" && (
                      <PermissionGate user={user} permission="ACCOUNTING_CANCEL">
                        <Button variant="ghost" size="sm" onClick={() => handleCancel(e.id)}>Annuler</Button>
                      </PermissionGate>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted-foreground)]">{total} écriture(s)</p>
        <div className="flex gap-2">
          {page > 1 && <Button variant="outline" size="sm" asChild><Link href={buildUrl({ page: String(page - 1) })}>Précédent</Link></Button>}
          {page < totalPages && <Button variant="outline" size="sm" asChild><Link href={buildUrl({ page: String(page + 1) })}>Suivant</Link></Button>}
        </div>
      </div>
    </div>
  );
}
