"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/pricing";
import type { ItemSalesReport } from "@/lib/item-sales";
import { exportItemSalesCsvAction } from "@/server/actions/item.actions";

type ItemsSalesPanelProps = {
  report: ItemSalesReport;
  filters: {
    from?: string;
    to?: string;
    customerId?: string;
  };
};

export function ItemsSalesPanel({ report, filters }: ItemsSalesPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "sales");
    const from = String(formData.get("from") || "");
    const to = String(formData.get("to") || "");
    const customerId = String(formData.get("customerId") || "");
    if (from) params.set("from", from);
    else params.delete("from");
    if (to) params.set("to", to);
    else params.delete("to");
    if (customerId) params.set("customerId", customerId);
    else params.delete("customerId");
    router.push(`/items?${params.toString()}`);
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportItemSalesCsvAction(filters);
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "ventes-produits.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Ventes par période</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="from">Date début</Label>
              <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Date fin</Label>
              <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerId">ID client (optionnel)</Label>
              <Input id="customerId" name="customerId" defaultValue={filters.customerId ?? ""} placeholder="Filtrer par client" />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Filtrer</Button>
              <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? "Export…" : "Export CSV"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Quantité vendue</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{report.totals.quantitySold}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">CA HT</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(report.totals.revenueExcludingTax)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">CA TTC</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(report.totals.revenueIncludingTax)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Marge estimée</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(report.totals.marginAmount)}</p></CardContent></Card>
      </div>

      <div className="rounded-xl border bg-white">
        {report.rows.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-muted-foreground)]">Aucune vente sur la période sélectionnée.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qté vendue</TableHead>
                <TableHead className="text-right">CA HT</TableHead>
                <TableHead className="text-right">CA TTC</TableHead>
                <TableHead className="text-right">Marge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row) => (
                <TableRow key={row.itemId}>
                  <TableCell>
                    <Link href={`/items/${row.itemId}`} className="font-medium hover:underline">{row.name}</Link>
                    <div className="text-xs text-[var(--color-muted-foreground)]">{row.itemNumber}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.sku ?? "—"}</TableCell>
                  <TableCell className="text-right">{row.quantitySold}{row.unitSymbol ? ` ${row.unitSymbol}` : ""}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.revenueExcludingTax)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.revenueIncludingTax)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.marginAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
