"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionGate } from "@/components/shared/permission-gate";
import { formatCurrency } from "@/lib/pricing";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import { exportVatSummaryCsvAction } from "@/server/actions/accounting-report.actions";

type Summary = {
  vatCollected: number;
  vatDeductible: number;
  vatNet: number;
  customerInvoiceCount: number;
  supplierInvoiceCount: number;
  rows: {
    date: Date;
    sourceType: string;
    documentNumber: string;
    partyName: string;
    baseExcludingTax: MoneyInput;
    vatAmount: MoneyInput;
    totalIncludingTax: MoneyInput;
  }[];
};

export function VatSummaryPageClient({ user, summary }: { user: SessionUser; summary: Summary }) {
  async function handleExport() {
    const result = await exportVatSummaryCsvAction({});
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "tva.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Synthèse TVA indicative</h1>
        <PermissionGate user={user} permission="ACCOUNTING_EXPORT">
          <Button variant="outline" onClick={handleExport}>Exporter CSV</Button>
        </PermissionGate>
      </div>

      <p className="text-sm text-amber-800">
        Cette synthèse TVA est indicative. Elle ne constitue pas une déclaration fiscale.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">TVA collectée</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(summary.vatCollected)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">TVA déductible</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(summary.vatDeductible)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">TVA nette indicative</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(summary.vatNet)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Factures clients</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{summary.customerInvoiceCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Factures fournisseurs</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{summary.supplierInvoiceCount}</p></CardContent></Card>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-left">Document</th>
              <th className="px-4 py-2 text-left">Tiers</th>
              <th className="px-4 py-2 text-right">Base HT</th>
              <th className="px-4 py-2 text-right">TVA</th>
              <th className="px-4 py-2 text-right">TTC</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.slice(0, 100).map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2">{formatDateShort(r.date)}</td>
                <td className="px-4 py-2">{r.sourceType}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.documentNumber}</td>
                <td className="px-4 py-2">{r.partyName}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.baseExcludingTax)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.vatAmount)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.totalIncludingTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
