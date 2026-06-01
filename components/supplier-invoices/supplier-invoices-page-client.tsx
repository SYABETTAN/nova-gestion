"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Eye, MoreHorizontal, Plus } from "lucide-react";
import type {
  SupplierInvoicePaymentStatus,
  SupplierInvoiceStatus,
} from "@/components/supplier-invoices/supplier-invoice-badges";
import type { PermissionKey } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  SupplierInvoicePaymentStatusBadge,
  SupplierInvoiceStatusBadge,
  SupplierInvoiceTypeBadge,
} from "@/components/supplier-invoices/supplier-invoice-badges";
import { formatCurrency } from "@/lib/pricing";
import {
  SUPPLIER_INVOICE_PAYMENT_STATUS_LABELS,
  SUPPLIER_INVOICE_STATUS_LABELS,
  SUPPLIER_INVOICE_TYPE_LABELS,
  isSupplierInvoiceEditable,
} from "@/lib/supplier-invoice-status";
import type { SupplierInvoiceStats } from "@/lib/supplier-invoice-utils";
import { isPositive } from "@/lib/money";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import {
  archiveSupplierInvoiceAction,
  exportSupplierInvoicesCsvAction,
  reactivateSupplierInvoiceAction,
} from "@/server/actions/supplier-invoice.actions";
import {
  cancelSupplierInvoiceAction,
  markSupplierInvoiceOverdueAction,
  markSupplierInvoicePaidPlaceholderAction,
  validateSupplierInvoiceAction,
} from "@/server/actions/supplier-invoice-status.actions";

type SupplierInvoiceRow = {
  id: string;
  supplierInvoiceNumber: string;
  supplierReference: string | null;
  title: string;
  type: string;
  status: SupplierInvoiceStatus;
  paymentStatus: SupplierInvoicePaymentStatus;
  issueDate: Date;
  dueDate: Date;
  totalExcludingTax: MoneyInput;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  currency: string;
  isArchived: boolean;
  supplier: { id: string; name: string; supplierNumber: string };
  expenseCategory: { name: string } | null;
};

export function SupplierInvoicesPageClient({
  user,
  invoices,
  suppliers,
  expenseCategories,
  stats,
  total,
  page,
  totalPages,
  filters,
}: {
  user: SessionUser;
  invoices: SupplierInvoiceRow[];
  suppliers: { id: string; name: string; supplierNumber: string }[];
  expenseCategories: { id: string; name: string }[];
  stats: SupplierInvoiceStats;
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
    return `/supplier-invoices?${params.toString()}`;
  }

  async function runAction(
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    msg: string,
  ) {
    const result = await action();
    if (result.success) {
      toast.success(result.message ?? msg);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportSupplierInvoicesCsvAction(
      Object.fromEntries(searchParams.entries()),
    );
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "factures-fournisseurs.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else if (!result.success) {
      toast.error("Erreur d'export");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Factures fournisseurs</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">
            Enregistrez et suivez les factures reçues de vos fournisseurs.
          </p>
        </div>
        <div className="flex gap-2">
          <PermissionGate user={user} permission={"SUPPLIER_INVOICES_EXPORT" as PermissionKey}>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Export..." : "Exporter CSV"}
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission={"SUPPLIER_INVOICES_CREATE" as PermissionKey}>
            <Button asChild>
              <Link href="/supplier-invoices/new">
                <Plus className="h-4 w-4" />
                Nouvelle facture
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Total", stats.total],
          ["Brouillons", stats.drafts],
          ["Validées", stats.validated],
          ["À payer", stats.toPay],
          ["En retard", stats.overdue],
          ["Reste à payer", formatCurrency(stats.totalDue)],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-4 md:grid-cols-6">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="q">Recherche</Label>
              <Input
                id="q"
                name="q"
                defaultValue={filters.q}
                placeholder="N° facture, fournisseur, référence..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status ?? ""}
                className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {(Object.keys(SUPPLIER_INVOICE_STATUS_LABELS) as SupplierInvoiceStatus[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {SUPPLIER_INVOICE_STATUS_LABELS[s]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentStatus">Paiement</Label>
              <select
                id="paymentStatus"
                name="paymentStatus"
                defaultValue={filters.paymentStatus ?? ""}
                className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {(
                  Object.keys(
                    SUPPLIER_INVOICE_PAYMENT_STATUS_LABELS,
                  ) as SupplierInvoicePaymentStatus[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {SUPPLIER_INVOICE_PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierId">Fournisseur</Label>
              <select
                id="supplierId"
                name="supplierId"
                defaultValue={filters.supplierId ?? ""}
                className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue={filters.type ?? ""}
                className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {Object.entries(SUPPLIER_INVOICE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expenseCategoryId">Catégorie</Label>
              <select
                id="expenseCategoryId"
                name="expenseCategoryId"
                defaultValue={filters.expenseCategoryId ?? ""}
                className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Toutes</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="archived">Archivées</Label>
              <select
                id="archived"
                name="archived"
                defaultValue={filters.archived ?? "false"}
                className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="false">Masquées</option>
                <option value="true">Inclure</option>
                <option value="only">Uniquement</option>
              </select>
            </div>
            <div className="flex items-end md:col-span-6">
              <Button type="submit" className="w-full sm:w-auto">
                Filtrer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="p-8 text-center text-[var(--color-muted-foreground)]">
              Aucune facture fournisseur pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° interne</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Réf. fournisseur</TableHead>
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
                    <TableCell className="font-mono text-sm">{inv.supplierInvoiceNumber}</TableCell>
                    <TableCell>
                      <Link
                        href={`/suppliers/${inv.supplier.id}`}
                        className="hover:underline"
                      >
                        {inv.supplier.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                      {inv.supplierReference ?? "—"}
                    </TableCell>
                    <TableCell>
                      <SupplierInvoiceTypeBadge type={inv.type} />
                    </TableCell>
                    <TableCell>
                      <SupplierInvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>
                      <SupplierInvoicePaymentStatusBadge status={inv.paymentStatus} />
                    </TableCell>
                    <TableCell>{formatDateShort(inv.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(inv.totalIncludingTax, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(inv.amountDue, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/supplier-invoices/${inv.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Voir
                            </Link>
                          </DropdownMenuItem>
                          {isSupplierInvoiceEditable(inv.status) && (
                            <PermissionGate user={user} permission={"SUPPLIER_INVOICES_UPDATE" as PermissionKey}>
                              <DropdownMenuItem asChild>
                                <Link href={`/supplier-invoices/${inv.id}/edit`}>Modifier</Link>
                              </DropdownMenuItem>
                            </PermissionGate>
                          )}
                          <DropdownMenuSeparator />
                          <PermissionGate user={user} permission={"SUPPLIER_INVOICES_VALIDATE" as PermissionKey}>
                            {inv.status === "DRAFT" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  runAction(
                                    () => validateSupplierInvoiceAction(inv.id),
                                    "Facture validée",
                                  )
                                }
                              >
                                Valider
                              </DropdownMenuItem>
                            )}
                            {inv.status === "VALIDATED" && inv.paymentStatus !== "PAID" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  runAction(
                                    () => markSupplierInvoicePaidPlaceholderAction(inv.id),
                                    "Paiement enregistré",
                                  )
                                }
                              >
                                Marquer payée (simulation)
                              </DropdownMenuItem>
                            )}
                            {inv.status === "VALIDATED" && isPositive(inv.amountDue) && (
                              <DropdownMenuItem asChild>
                                <Link href={`/supplier-invoices/${inv.id}?partial=1`}>
                                  Paiement partiel
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {inv.status === "VALIDATED" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  runAction(
                                    () => markSupplierInvoiceOverdueAction(inv.id),
                                    "Marquée en retard",
                                  )
                                }
                              >
                                Marquer en retard
                              </DropdownMenuItem>
                            )}
                          </PermissionGate>
                          <PermissionGate user={user} permission={"SUPPLIER_INVOICES_CANCEL" as PermissionKey}>
                            {inv.status !== "CANCELLED" && (
                              <DropdownMenuItem asChild>
                                <Link href={`/supplier-invoices/${inv.id}?cancel=1`}>
                                  Annuler
                                </Link>
                              </DropdownMenuItem>
                            )}
                          </PermissionGate>
                          <PermissionGate user={user} permission={"SUPPLIER_INVOICES_UPDATE" as PermissionKey}>
                            <DropdownMenuSeparator />
                            {inv.isArchived ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  runAction(
                                    () => reactivateSupplierInvoiceAction(inv.id),
                                    "Facture réactivée",
                                  )
                                }
                              >
                                Réactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  runAction(
                                    () => archiveSupplierInvoiceAction(inv.id),
                                    "Facture archivée",
                                  )
                                }
                              >
                                Archiver
                              </DropdownMenuItem>
                            )}
                          </PermissionGate>
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
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {total} factures — page {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl({ page: String(page - 1) })}>Précédent</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl({ page: String(page + 1) })}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
