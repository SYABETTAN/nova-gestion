"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Download } from "lucide-react";
import type { CustomerTag } from "@prisma/client";
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
import { CustomerStatusBadge, CustomerTypeBadge } from "@/components/customers/customer-badges";
import { formatCurrency } from "@/lib/customer-utils";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import {
  archiveCustomerAction,
  exportCustomersCsvAction,
  reactivateCustomerAction,
} from "@/server/actions/customer.actions";

type CustomerRow = {
  id: string;
  customerNumber: string;
  name: string;
  type: "COMPANY" | "INDIVIDUAL";
  status: "PROSPECT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  email: string | null;
  phone: string | null;
  outstandingAmount: MoneyInput;
  currency: string;
  createdAt: Date;
  isArchived: boolean;
  addresses: { city: string }[];
  tagAssignments: { tag: { id: string; name: string; color: string } }[];
};

type Stats = {
  total: number;
  prospects: number;
  active: number;
  totalOutstanding: number;
};

type CustomersPageClientProps = {
  user: SessionUser;
  customers: CustomerRow[];
  tags: CustomerTag[];
  stats: Stats;
  total: number;
  page: number;
  totalPages: number;
  filters: Record<string, string | undefined>;
};

export function CustomersPageClient({
  user,
  customers,
  tags,
  stats,
  total,
  page,
  totalPages,
  filters,
}: CustomersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    if (!updates.page) params.set("page", "1");
    return `/customers?${params.toString()}`;
  }

  async function handleArchive(id: string) {
    if (!confirm("Archiver ce client ?")) return;
    const result = await archiveCustomerAction(id);
    if (result.success) toast.success("Client archivé");
    else toast.error(result.error ?? "Erreur");
  }

  async function handleReactivate(id: string) {
    const result = await reactivateCustomerAction(id);
    if (result.success) toast.success("Client réactivé");
    else toast.error(result.error ?? "Erreur");
  }

  async function handleExport() {
    setExporting(true);
    const params = Object.fromEntries(searchParams.entries());
    const result = await exportCustomersCsvAction(params);
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "clients.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Erreur lors de l'export");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">
            Gérez vos prospects et clients — données fictives
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? "Export..." : "Exporter CSV"}
          </Button>
          <PermissionGate user={user} permission="CUSTOMERS_CREATE">
            <Button asChild>
              <Link href="/customers/new">
                <Plus className="h-4 w-4" />
                Nouveau client
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Total clients</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Prospects</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.prospects}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Clients actifs</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.active}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Encours total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(stats.totalOutstanding)}</p></CardContent>
        </Card>
      </div>

      <form method="get" className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-6">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="q">Recherche</Label>
          <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Nom, email, SIRET..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Statut</Label>
          <select id="status" name="status" defaultValue={filters.status ?? ""} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="">Tous</option>
            <option value="PROSPECT">Prospect</option>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <select id="type" name="type" defaultValue={filters.type ?? ""} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="">Tous</option>
            <option value="COMPANY">Société</option>
            <option value="INDIVIDUAL">Particulier</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tagId">Tag</Label>
          <select id="tagId" name="tagId" defaultValue={filters.tagId ?? ""} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="">Tous</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" defaultValue={filters.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="archived">Archivés</Label>
          <select id="archived" name="archived" defaultValue={filters.archived ?? "false"} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="false">Actifs uniquement</option>
            <option value="only">Archivés uniquement</option>
            <option value="true">Tous</option>
          </select>
        </div>
        <div className="md:col-span-6">
          <Button type="submit">Filtrer</Button>
        </div>
      </form>

      <div className="rounded-xl border bg-white">
        {customers.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-muted-foreground)]">
            Aucun client pour le moment.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° client</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Encours</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.customerNumber}</TableCell>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell><CustomerTypeBadge type={c.type} /></TableCell>
                  <TableCell><CustomerStatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.addresses[0]?.city ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.tagAssignments.map((a) => (
                        <span
                          key={a.tag.id}
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: a.tag.color }}
                        >
                          {a.tag.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(c.outstandingAmount, c.currency)}</TableCell>
                  <TableCell className="text-sm">{formatDateShort(c.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/customers/${c.id}`}>Voir</Link>
                        </DropdownMenuItem>
                        <PermissionGate user={user} permission="CUSTOMERS_UPDATE">
                          <DropdownMenuItem asChild>
                            <Link href={`/customers/${c.id}/edit`}>Modifier</Link>
                          </DropdownMenuItem>
                        </PermissionGate>
                        <DropdownMenuSeparator />
                        <PermissionGate user={user} permission="CUSTOMERS_DELETE">
                          {c.isArchived ? (
                            <DropdownMenuItem onClick={() => handleReactivate(c.id)}>
                              Réactiver
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleArchive(c.id)}>
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
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {total} client{total > 1 ? "s" : ""} — Page {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" onClick={() => router.push(buildUrl({ page: String(page - 1) }))}>
                Précédent
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" onClick={() => router.push(buildUrl({ page: String(page + 1) }))}>
                Suivant
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
