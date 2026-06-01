"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Eye, MoreHorizontal, Plus } from "lucide-react";
import type { QuoteStatus } from "@prisma/client";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { formatCurrency } from "@/lib/pricing";
import { QUOTE_STATUS_LABELS } from "@/lib/quote-status";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import {
  archiveQuoteAction,
  duplicateQuoteAction,
  exportQuotesCsvAction,
  reactivateQuoteAction,
} from "@/server/actions/quote.actions";
import {
  acceptQuoteAction,
  generateQuotePdfPlaceholderAction,
  refuseQuoteAction,
} from "@/server/actions/quote-status.actions";

type QuoteRow = {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  issueDate: Date;
  validUntil: Date;
  totalExcludingTax: MoneyInput;
  totalIncludingTax: MoneyInput;
  currency: string;
  isArchived: boolean;
  createdAt: Date;
  customer: { id: string; name: string };
  createdBy: { id: string; name: string } | null;
};

type Stats = {
  total: number;
  drafts: number;
  sent: number;
  accepted: number;
  acceptedAmount: number;
  pendingAmount: number;
  acceptanceRate: number;
  expired: number;
  averageBasket: number;
};

type QuotesPageClientProps = {
  user: SessionUser;
  quotes: QuoteRow[];
  customers: { id: string; name: string }[];
  stats: Stats;
  total: number;
  page: number;
  totalPages: number;
  filters: Record<string, string | undefined>;
};

export function QuotesPageClient({
  user,
  quotes,
  customers,
  stats,
  total,
  page,
  totalPages,
  filters,
}: QuotesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    if (!updates.page) params.set("page", "1");
    return `/quotes?${params.toString()}`;
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportQuotesCsvAction(Object.fromEntries(searchParams.entries()));
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "devis.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    }
  }

  async function runAction(
    action: () => Promise<{
      success: boolean;
      error?: string;
      quoteId?: string;
      printUrl?: string;
      downloadUrl?: string;
    }>,
    successMsg: string,
  ) {
    const result = await action();
    if (result.success) {
      toast.success(successMsg);
      if (result.quoteId) router.push(`/quotes/${result.quoteId}`);
      if (result.downloadUrl) window.open(result.downloadUrl, "_blank");
      else if (result.printUrl) window.open(result.printUrl, "_blank");
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Devis</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">
            Créez et suivez vos devis dans l{"'"}environnement 
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? "Export..." : "Exporter CSV"}
          </Button>
          <PermissionGate user={user} permission="QUOTES_CREATE">
            <Button asChild>
              <Link href="/quotes/new">
                <Plus className="h-4 w-4" /> Nouveau devis
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Total devis", stats.total],
          ["Brouillons", stats.drafts],
          ["Envoyés", stats.sent],
          ["Acceptés", stats.accepted],
          ["Montant accepté", formatCurrency(stats.acceptedAmount)],
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
              <Input id="q" name="q" defaultValue={filters.q} placeholder="N° devis, client, titre..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <select id="status" name="status" defaultValue={filters.status ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Tous</option>
                {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((s) => (
                  <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>
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
              <Label htmlFor="archived">Archivé</Label>
              <select id="archived" name="archived" defaultValue={filters.archived ?? "false"} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="false">Actifs</option>
                <option value="only">Archivés</option>
                <option value="true">Tous</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">Filtrer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {quotes.length === 0 ? (
            <p className="p-8 text-center text-[var(--color-muted-foreground)]">
              Aucun devis pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° devis</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead>Créateur</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-mono text-sm">{quote.quoteNumber}</TableCell>
                    <TableCell>{quote.customer.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{quote.title}</TableCell>
                    <TableCell><QuoteStatusBadge status={quote.status} /></TableCell>
                    <TableCell>{formatDateShort(quote.issueDate)}</TableCell>
                    <TableCell>{formatDateShort(quote.validUntil)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(quote.totalIncludingTax, quote.currency)}
                    </TableCell>
                    <TableCell className="text-sm">{quote.createdBy?.name ?? "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/quotes/${quote.id}`}><Eye className="mr-2 h-4 w-4" /> Voir</Link>
                          </DropdownMenuItem>
                          <PermissionGate user={user} permission="QUOTES_UPDATE">
                            <DropdownMenuItem asChild>
                              <Link href={`/quotes/${quote.id}/edit`}>Modifier</Link>
                            </DropdownMenuItem>
                          </PermissionGate>
                          <PermissionGate user={user} permission="QUOTES_CREATE">
                            <DropdownMenuItem onClick={() => runAction(() => duplicateQuoteAction(quote.id), "Devis dupliqué")}>
                              Dupliquer
                            </DropdownMenuItem>
                          </PermissionGate>
                          <DropdownMenuItem onClick={() => runAction(() => generateQuotePdfPlaceholderAction(quote.id), "PDF ouvert")}>
                            Générer PDF
                          </DropdownMenuItem>
                          <PermissionGate user={user} permission="QUOTES_VALIDATE">
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => runAction(() => acceptQuoteAction(quote.id), "Devis accepté")}>
                              Marquer accepté
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => runAction(() => refuseQuoteAction(quote.id), "Devis refusé")}>
                              Marquer refusé
                            </DropdownMenuItem>
                          </PermissionGate>
                          <PermissionGate user={user} permission="QUOTES_DELETE">
                            <DropdownMenuSeparator />
                            {quote.isArchived ? (
                              <DropdownMenuItem onClick={() => runAction(() => reactivateQuoteAction(quote.id), "Devis réactivé")}>
                                Réactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => runAction(() => archiveQuoteAction(quote.id), "Devis archivé")}>
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
            {total} devis — page {page} / {totalPages}
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
