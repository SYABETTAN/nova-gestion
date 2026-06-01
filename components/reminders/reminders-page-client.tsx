"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, History, Mail, Settings } from "lucide-react";
import type { ReminderLevel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ReminderLevelBadge } from "@/components/reminders/reminder-badges";
import { ReminderSendDialog } from "@/components/reminders/reminder-send-dialog";
import { REMINDER_LEVEL_LABELS } from "@/lib/reminder-utils";
import { formatCurrency } from "@/lib/pricing";
import type { MoneyInput } from "@/lib/money";
import type { SessionUser } from "@/lib/permissions";
import { formatDateShort } from "@/lib/utils";
import {
  exportRemindersCsvAction,
  sendBulkReminderSimulationAction,
} from "@/server/actions/reminder.actions";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  currency: string;
  reminderCount: number;
  lastReminderAt: Date | null;
  isCollectionPaused: boolean;
  isDisputed: boolean;
  promisedPaymentDate: Date | null;
  daysOverdue: number;
  recommendedLevel: ReminderLevel;
  customer: { id: string; name: string; email: string | null };
};

type Stats = {
  toRemindCount: number;
  totalOverdue: number;
  bucket1_7: number;
  bucket8_30: number;
  bucket30plus: number;
  remindersThisMonth: number;
};

export function RemindersPageClient({
  user,
  invoices,
  customers,
  stats,
  total,
  page,
  totalPages,
  filters,
}: {
  user: SessionUser;
  invoices: InvoiceRow[];
  customers: { id: string; name: string }[];
  stats: Stats;
  total: number;
  page: number;
  totalPages: number;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    if (!updates.page) params.set("page", "1");
    return `/reminders?${params.toString()}`;
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? invoices.filter((i) => !i.isDisputed && !i.isCollectionPaused).map((i) => i.id) : []);
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportRemindersCsvAction(Object.fromEntries(searchParams.entries()));
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "relances.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    }
  }

  async function handleBulkSend() {
    if (selected.length === 0) return;
    if (!confirm(`Simuler l'envoi de ${selected.length} relance(s) ?`)) return;
    setBulkLoading(true);
    const result = await sendBulkReminderSimulationAction({ invoiceIds: selected });
    setBulkLoading(false);
    if (result.success) {
      toast.success(result.message);
      setSelected([]);
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Relances clients</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">
            Suivez et envoyez les relances des factures en retard.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/reminders/history"><History className="h-4 w-4" /> Historique</Link></Button>
          <Button variant="outline" asChild><Link href="/reminders/templates"><Settings className="h-4 w-4" /> Modèles</Link></Button>
          <PermissionGate user={user} permission="REMINDERS_EXPORT">
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />{exporting ? "Export..." : "Exporter CSV"}
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission="REMINDERS_SEND">
            <Button onClick={handleBulkSend} disabled={selected.length === 0 || bulkLoading}>
              Relancer la sélection ({selected.length})
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Factures à relancer", stats.toRemindCount],
          ["Montant en retard", formatCurrency(stats.totalOverdue)],
          ["Retard 1-7 j", stats.bucket1_7],
          ["Retard 8-30 j", stats.bucket8_30],
          ["Retard +30 j", stats.bucket30plus],
          ["Relances du mois", stats.remindersThisMonth],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["1-7 j", "1-7"],
          ["8-30 j", "8-30"],
          ["31-60 j", "31-60"],
          ["+60 j", "60+"],
          ["Sans relance", "no-reminder"],
          ["Litiges", "disputed"],
          ["Suspendues", "paused"],
          ["Promesses", "promised"],
        ].map(([label, key]) => (
          <Button key={key} variant={filters.quickFilter === key ? "default" : "outline"} size="sm" asChild>
            <Link href={buildUrl({ quickFilter: key })}>{label}</Link>
          </Button>
        ))}
        <Button variant="outline" size="sm" asChild><Link href="/reminders">Tout</Link></Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="q">Recherche</Label>
              <Input id="q" name="q" defaultValue={filters.q} placeholder="Client, facture, email..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerId">Client</Label>
              <select id="customerId" name="customerId" defaultValue={filters.customerId ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Tous</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Niveau</Label>
              <select id="level" name="level" defaultValue={filters.level ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Tous</option>
                {Object.entries(REMINDER_LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-end"><Button type="submit">Filtrer</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="p-8 text-center text-[var(--color-muted-foreground)]">Aucune facture à relancer pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selected.length === invoices.length && invoices.length > 0}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Retard</TableHead>
                  <TableHead className="text-right">Reste dû</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Relances</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const eligible = !inv.isDisputed && !inv.isCollectionPaused;
                  return (
                    <TableRow key={inv.id} className={inv.isDisputed ? "bg-red-50/50" : inv.isCollectionPaused ? "bg-amber-50/50" : ""}>
                      <TableCell>
                        {eligible && (
                          <input
                            type="checkbox"
                            checked={selected.includes(inv.id)}
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked ? [...prev, inv.id] : prev.filter((id) => id !== inv.id),
                              )
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>{inv.customer.name}</TableCell>
                      <TableCell className="font-mono"><Link href={`/invoices/${inv.id}`} className="hover:underline">{inv.invoiceNumber}</Link></TableCell>
                      <TableCell>{formatDateShort(inv.dueDate)}</TableCell>
                      <TableCell><span className="font-semibold text-red-600">{inv.daysOverdue} j</span></TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.amountDue, inv.currency)}</TableCell>
                      <TableCell><ReminderLevelBadge level={inv.recommendedLevel} /></TableCell>
                      <TableCell>
                        {inv.reminderCount}
                        {inv.lastReminderAt && <p className="text-xs text-[var(--color-muted-foreground)]">{formatDateShort(inv.lastReminderAt)}</p>}
                      </TableCell>
                      <TableCell>
                        {inv.isDisputed && <Badge variant="destructive">Litige</Badge>}
                        {inv.isCollectionPaused && <Badge variant="warning">Suspendue</Badge>}
                        {inv.promisedPaymentDate && <Badge variant="outline">Promesse</Badge>}
                        {eligible && (
                          <PermissionGate user={user} permission="REMINDERS_SEND">
                            <Button size="sm" variant="ghost" onClick={() => { setSendInvoiceId(inv.id); setSendOpen(true); }}>
                              <Mail className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">{total} facture(s)</p>
          <div className="flex gap-2">
            {page > 1 && <Button variant="outline" asChild><Link href={buildUrl({ page: String(page - 1) })}>Précédent</Link></Button>}
            <span className="flex items-center px-2 text-sm">Page {page} / {totalPages}</span>
            {page < totalPages && <Button variant="outline" asChild><Link href={buildUrl({ page: String(page + 1) })}>Suivant</Link></Button>}
          </div>
        </div>
      )}

      <ReminderSendDialog
        invoiceId={sendInvoiceId}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
