"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Eye, MoreHorizontal, Plus } from "lucide-react";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";
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
import { PaymentMethodBadge, PaymentStatusBadge } from "@/components/payments/payment-badges";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payment-status";
import { formatCurrency } from "@/lib/pricing";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import { exportPaymentsCsvAction } from "@/server/actions/payment.actions";
import { generatePaymentReceiptAction } from "@/server/actions/payment-receipt.actions";
import { cancelPaymentAction } from "@/server/actions/payment-allocation.actions";

type PaymentRow = {
  id: string;
  paymentNumber: string;
  status: PaymentStatus;
  method: PaymentMethod;
  paymentDate: Date;
  amount: MoneyInput;
  allocatedAmount: MoneyInput;
  unallocatedAmount: MoneyInput;
  reference: string | null;
  currency: string;
  createdAt: Date;
  customer: { id: string; name: string };
};

type Stats = {
  total: number;
  totalAmount: number;
  totalAllocated: number;
  totalUnallocated: number;
  thisMonth: number;
  paidInvoices: number;
};

export function PaymentsPageClient({
  user,
  payments,
  customers,
  stats,
  total,
  page,
  totalPages,
  filters,
}: {
  user: SessionUser;
  payments: PaymentRow[];
  customers: { id: string; name: string }[];
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
    return `/payments?${params.toString()}`;
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportPaymentsCsvAction(Object.fromEntries(searchParams.entries()));
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "paiements.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    }
  }

  async function handleCancel(id: string) {
    const reason = prompt("Raison de l'annulation (min. 3 caractères) :");
    if (!reason || reason.length < 3) return;
    const result = await cancelPaymentAction({ paymentId: id, reason });
    if (result.success) {
      toast.success(result.message ?? "Paiement annulé");
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  async function handleReceipt(id: string) {
    const result = await generatePaymentReceiptAction(id);
    if (result.success && result.receiptUrl) window.open(result.receiptUrl, "_blank");
    else toast.error(result.error ?? "Erreur");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Paiements</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">
            Suivez les règlements clients dans l{"'"}environnement 
          </p>
        </div>
        <div className="flex gap-2">
          <PermissionGate user={user} permission="PAYMENTS_EXPORT">
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Export..." : "Exporter CSV"}
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission="PAYMENTS_CREATE">
            <Button asChild>
              <Link href="/payments/new">
                <Plus className="h-4 w-4" />
                Nouveau paiement
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Total paiements", stats.total],
          ["Montant encaissé", formatCurrency(stats.totalAmount)],
          ["Montant alloué", formatCurrency(stats.totalAllocated)],
          ["Non alloué", formatCurrency(stats.totalUnallocated)],
          ["Paiements du mois", stats.thisMonth],
          ["Factures soldées", stats.paidInvoices],
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
              <Input id="q" name="q" defaultValue={filters.q} placeholder="N° paiement, client, référence..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <select id="status" name="status" defaultValue={filters.status ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Tous</option>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Mode</Label>
              <select id="method" name="method" defaultValue={filters.method ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Tous</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerId">Client</Label>
              <select id="customerId" name="customerId" defaultValue={filters.customerId ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Tous</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unallocated">Non alloués</Label>
              <select id="unallocated" name="unallocated" defaultValue={filters.unallocated ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Tous</option>
                <option value="true">Oui</option>
              </select>
            </div>
            <div className="md:col-span-6 flex gap-2">
              <Button type="submit">Filtrer</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/payments">Réinitialiser</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="p-8 text-center text-[var(--color-muted-foreground)]">
              Aucun paiement pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° paiement</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Alloué</TableHead>
                  <TableHead className="text-right">Non alloué</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">
                      <Link href={`/payments/${p.id}`} className="hover:underline">{p.paymentNumber}</Link>
                    </TableCell>
                    <TableCell>{p.customer.name}</TableCell>
                    <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                    <TableCell><PaymentMethodBadge method={p.method} /></TableCell>
                    <TableCell>{formatDateShort(p.paymentDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.amount, p.currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.allocatedAmount, p.currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.unallocatedAmount, p.currency)}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{p.reference ?? "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/payments/${p.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link>
                          </DropdownMenuItem>
                          {p.status !== "CANCELLED" && (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={`/payments/${p.id}/edit`}>Modifier</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReceipt(p.id)}>Générer reçu</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleCancel(p.id)}>
                                Annuler
                              </DropdownMenuItem>
                            </>
                          )}
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
          <p className="text-sm text-[var(--color-muted-foreground)]">{total} paiement(s)</p>
          <div className="flex gap-2">
            {page > 1 && <Button variant="outline" asChild><Link href={buildUrl({ page: String(page - 1) })}>Précédent</Link></Button>}
            <span className="flex items-center px-2 text-sm">Page {page} / {totalPages}</span>
            {page < totalPages && <Button variant="outline" asChild><Link href={buildUrl({ page: String(page + 1) })}>Suivant</Link></Button>}
          </div>
        </div>
      )}
    </div>
  );
}
