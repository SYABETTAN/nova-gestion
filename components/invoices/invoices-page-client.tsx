"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Eye, MoreHorizontal, Plus } from "lucide-react";
import type { InvoicePaymentStatus, InvoiceStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerFilterField } from "@/components/shared/customer-filter-field";
import type { CustomerSelectOption } from "@/components/shared/customer-search-select";
import { PermissionGate } from "@/components/shared/permission-gate";
import { InvoicePaymentStatusBadge, InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/invoices/invoice-badges";
import { formatCurrency } from "@/lib/pricing";
import { canMarkPaid, INVOICE_PAYMENT_STATUS_LABELS, INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/invoice-status";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import { archiveInvoiceAction, duplicateInvoiceAction, exportInvoicesCsvAction, reactivateInvoiceAction } from "@/server/actions/invoice.actions";
import { generateInvoicePdfPlaceholderAction, validateInvoiceAction } from "@/server/actions/invoice-status.actions";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  title: string;
  type: string;
  status: InvoiceStatus;
  paymentStatus: InvoicePaymentStatus;
  issueDate: Date;
  dueDate: Date;
  totalExcludingTax: MoneyInput;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  currency: string;
  isArchived: boolean;
  customer: { id: string; name: string };
};

type Stats = {
  total: number;
  drafts: number;
  validatedOrSent: number;
  paid: number;
  overdue: number;
  toCollect: number;
};

export function InvoicesPageClient({
  user,
  invoices,
  initialCustomerOption,
  stats,
  total,
  page,
  totalPages,
  filters,
}: {
  user: SessionUser;
  invoices: InvoiceRow[];
  initialCustomerOption: CustomerSelectOption | null;
  stats: Stats;
  total: number;
  page: number;
  totalPages: number;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    if (!updates.page) params.set("page", "1");
    return `/invoices?${params.toString()}`;
  }

  async function runAction(action: () => Promise<{ success: boolean; error?: string; invoiceId?: string; printUrl?: string; message?: string }>, msg: string) {
    const result = await action();
    if (result.success) {
      toast.success(result.message ?? msg);
      if (result.invoiceId) router.push(`/invoices/${result.invoiceId}`);
      if (result.printUrl) window.open(result.printUrl, "_blank");
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportInvoicesCsvAction(Object.fromEntries(searchParams.entries()));
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "factures.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Factures</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">
            Créez et suivez vos factures dans l{"'"}environnement 
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />{exporting ? "Export..." : "Exporter CSV"}
          </Button>
          <PermissionGate user={user} permission="INVOICES_CREATE">
            <Button asChild><Link href="/invoices/new"><Plus className="h-4 w-4" />Nouvelle facture</Link></Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Total", stats.total],
          ["Brouillons", stats.drafts],
          ["Validées / envoyées", stats.validatedOrSent],
          ["Payées", stats.paid],
          ["En retard", stats.overdue],
          ["À encaisser", formatCurrency(stats.toCollect)],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-4 md:grid-cols-8">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="q">Recherche</Label>
              <Input id="q" name="q" defaultValue={filters.q} placeholder="N° facture, client..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <select id="status" name="status" defaultValue={filters.status ?? ""} className="flex h-10 w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Tous</option>
                {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
                  <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentStatus">Paiement</Label>
              <select id="paymentStatus" name="paymentStatus" defaultValue={filters.paymentStatus ?? ""} className="flex h-10 w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Tous</option>
                {(Object.keys(INVOICE_PAYMENT_STATUS_LABELS) as InvoicePaymentStatus[]).map((s) => (
                  <option key={s} value={s}>{INVOICE_PAYMENT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <CustomerFilterField
              initialCustomerId={filters.customerId}
              initialOption={initialCustomerOption}
            />
            <div className="space-y-2">
              <Label htmlFor="issueDateFrom">Date début</Label>
              <Input id="issueDateFrom" name="issueDateFrom" type="date" defaultValue={filters.issueDateFrom ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issueDateTo">Date fin</Label>
              <Input id="issueDateTo" name="issueDateTo" type="date" defaultValue={filters.issueDateTo ?? ""} />
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button type="submit" className="w-full">Filtrer</Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/invoices")}>
                Reinitialiser
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="p-8 text-center text-[var(--color-muted-foreground)]">
              Aucune facture trouvee pour les filtres actuels.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead className="text-right">Reste dû</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.customer.name}</TableCell>
                    <TableCell><InvoiceTypeBadge type={inv.type} /></TableCell>
                    <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                    <TableCell><InvoicePaymentStatusBadge status={inv.paymentStatus} /></TableCell>
                    <TableCell>{formatDateShort(inv.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.totalIncludingTax, inv.currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.amountDue, inv.currency)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/invoices/${inv.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                          {inv.status === "DRAFT" && (
                            <PermissionGate user={user} permission="INVOICES_UPDATE">
                              <DropdownMenuItem asChild><Link href={`/invoices/${inv.id}/edit`}>Modifier</Link></DropdownMenuItem>
                            </PermissionGate>
                          )}
                          <PermissionGate user={user} permission="INVOICES_VALIDATE">
                            {inv.status === "DRAFT" && (
                              <DropdownMenuItem onClick={() => runAction(() => validateInvoiceAction(inv.id), "Facture validée")}>Valider</DropdownMenuItem>
                            )}
                            {canMarkPaid(inv.status) && (
                              <DropdownMenuItem asChild>
                                <Link href={`/payments/new?invoiceId=${inv.id}`}>Enregistrer un paiement</Link>
                              </DropdownMenuItem>
                            )}
                          </PermissionGate>
                          <DropdownMenuItem onClick={() => runAction(() => generateInvoicePdfPlaceholderAction(inv.id), "PDF ouvert")}>PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">{total} factures — page {page} / {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 && <Button variant="outline" size="sm" asChild><Link href={buildUrl({ page: String(page - 1) })}>Précédent</Link></Button>}
            {page < totalPages && <Button variant="outline" size="sm" asChild><Link href={buildUrl({ page: String(page + 1) })}>Suivant</Link></Button>}
          </div>
        </div>
      )}
    </div>
  );
}
