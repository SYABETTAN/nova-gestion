"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { formatCurrency } from "@/lib/pricing";
import type { SessionUser } from "@/lib/permissions";
import type { TrialBalanceRow } from "@/lib/trial-balance";
import { computeTrialBalanceTotals } from "@/lib/trial-balance";
import { exportTrialBalanceCsvAction } from "@/server/actions/accounting-report.actions";

export function TrialBalancePageClient({
  user,
  rows,
}: {
  user: SessionUser;
  rows: TrialBalanceRow[];
}) {
  const totals = computeTrialBalanceTotals(rows);

  async function handleExport() {
    const result = await exportTrialBalanceCsvAction({});
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "balance.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Balance simplifiée</h1>
        <PermissionGate user={user} permission="ACCOUNTING_EXPORT">
          <Button variant="outline" onClick={handleExport}>Exporter CSV</Button>
        </PermissionGate>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Compte</th>
              <th className="px-4 py-2 text-left">Nom</th>
              <th className="px-4 py-2 text-right">Total débit</th>
              <th className="px-4 py-2 text-right">Total crédit</th>
              <th className="px-4 py-2 text-right">Solde débiteur</th>
              <th className="px-4 py-2 text-right">Solde créditeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.accountId} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono">{r.accountNumber}</td>
                <td className="px-4 py-2">{r.accountName}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.totalDebit)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.totalCredit)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.debitBalance)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.creditBalance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-slate-50 font-medium">
            <tr>
              <td colSpan={2} className="px-4 py-2 text-right">Totaux</td>
              <td className="px-4 py-2 text-right">{formatCurrency(totals.totalDebit)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(totals.totalCredit)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(totals.totalDebitBalance)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(totals.totalCreditBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
