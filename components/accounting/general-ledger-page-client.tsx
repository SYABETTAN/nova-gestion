"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { formatCurrency } from "@/lib/pricing";
import type { SessionUser } from "@/lib/permissions";
import { formatDateShort } from "@/lib/utils";
import type { GeneralLedgerRow } from "@/lib/general-ledger";
import { exportGeneralLedgerCsvAction } from "@/server/actions/accounting-report.actions";

export function GeneralLedgerPageClient({
  user,
  rows,
}: {
  user: SessionUser;
  rows: GeneralLedgerRow[];
}) {
  async function handleExport() {
    const result = await exportGeneralLedgerCsvAction({});
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "grand-livre.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Grand livre simplifié</h1>
        <PermissionGate user={user} permission="ACCOUNTING_EXPORT">
          <Button variant="outline" onClick={handleExport}>Exporter CSV</Button>
        </PermissionGate>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Journal</th>
              <th className="px-4 py-2 text-left">Écriture</th>
              <th className="px-4 py-2 text-left">Compte</th>
              <th className="px-4 py-2 text-left">Libellé</th>
              <th className="px-4 py-2 text-right">Débit</th>
              <th className="px-4 py-2 text-right">Crédit</th>
              <th className="px-4 py-2 text-right">Solde prog.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--color-muted-foreground)]">Aucune ligne.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2">{formatDateShort(r.entryDate)}</td>
                <td className="px-4 py-2">{r.journalCode}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.entryNumber}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.accountNumber}</td>
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2 text-right">{r.debit > 0 ? formatCurrency(r.debit) : "—"}</td>
                <td className="px-4 py-2 text-right">{r.credit > 0 ? formatCurrency(r.credit) : "—"}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
