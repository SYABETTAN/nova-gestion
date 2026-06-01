"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, MoreHorizontal, Plus, Star } from "lucide-react";
import type { SupplierTag } from "@prisma/client";
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
  SupplierRiskBadge,
  SupplierStatusBadge,
  SupplierTypeBadge,
} from "@/components/suppliers/supplier-badges";
import { formatCurrency, getPrimaryCity, type SupplierStats } from "@/lib/supplier-utils";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import {
  archiveSupplierAction,
  exportSuppliersCsvAction,
  reactivateSupplierAction,
} from "@/server/actions/supplier.actions";

type SupplierCategoryOption = {
  id: string;
  name: string;
};

type SupplierRow = {
  id: string;
  supplierNumber: string;
  name: string;
  type: "COMPANY" | "INDIVIDUAL";
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  email: string | null;
  phone: string | null;
  outstandingAmount: MoneyInput;
  totalPurchasesAmount: MoneyInput;
  currency: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  isPreferred: boolean;
  createdAt: Date;
  isArchived: boolean;
  category: { id: string; name: string } | null;
  addresses: { city: string; isDefault: boolean; type: string }[];
  tagAssignments: { tag: { id: string; name: string; color: string } }[];
};

type SuppliersPageClientProps = {
  user: SessionUser;
  suppliers: SupplierRow[];
  tags: SupplierTag[];
  categories: SupplierCategoryOption[];
  stats: SupplierStats;
  total: number;
  page: number;
  totalPages: number;
  filters: Record<string, string | undefined>;
};

export function SuppliersPageClient({
  user,
  suppliers,
  tags,
  categories,
  stats,
  total,
  page,
  totalPages,
  filters,
}: SuppliersPageClientProps) {
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
    return `/suppliers?${params.toString()}`;
  }

  async function handleArchive(id: string) {
    if (!confirm("Archiver ce fournisseur ?")) return;
    const result = await archiveSupplierAction(id);
    if (result.success) toast.success("Fournisseur archivé");
    else toast.error(result.error ?? "Erreur");
  }

  async function handleReactivate(id: string) {
    const result = await reactivateSupplierAction(id);
    if (result.success) toast.success("Fournisseur réactivé");
    else toast.error(result.error ?? "Erreur");
  }

  async function handleExport() {
    setExporting(true);
    const params = Object.fromEntries(searchParams.entries());
    const result = await exportSuppliersCsvAction(params);
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "fournisseurs.csv";
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
            <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">
            Gérez votre fichier fournisseurs — données fictives
          </p>
        </div>
        <div className="flex gap-2">
          <PermissionGate user={user} permission="SUPPLIERS_EXPORT">
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Export..." : "Exporter CSV"}
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission="SUPPLIERS_CREATE">
            <Button asChild>
              <Link href="/suppliers/new">
                <Plus className="h-4 w-4" />
                Nouveau fournisseur
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Total fournisseurs</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Fournisseurs actifs</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.active}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Fournisseurs préférés</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.preferred}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Encours total</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(stats.totalOutstanding)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">Achats totaux</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(stats.totalPurchases)}</p></CardContent>
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
          <Label htmlFor="categoryId">Catégorie</Label>
          <select id="categoryId" name="categoryId" defaultValue={filters.categoryId ?? ""} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
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
          <Label htmlFor="riskLevel">Risque</Label>
          <select id="riskLevel" name="riskLevel" defaultValue={filters.riskLevel ?? ""} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="">Tous</option>
            <option value="LOW">Risque faible</option>
            <option value="MEDIUM">Risque moyen</option>
            <option value="HIGH">Risque élevé</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="preferred">Préféré</Label>
          <select id="preferred" name="preferred" defaultValue={filters.preferred ?? ""} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="">Tous</option>
            <option value="true">Préférés uniquement</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="archived">Archivés</Label>
          <select id="archived" name="archived" defaultValue={filters.archived ?? "false"} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="false">Actifs uniquement</option>
            <option value="only">Archivés uniquement</option>
            <option value="true">Tous</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortBy">Tri</Label>
          <select id="sortBy" name="sortBy" defaultValue={filters.sortBy ?? "createdAt"} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="createdAt">Date de création</option>
            <option value="name">Nom</option>
            <option value="outstandingAmount">Encours</option>
            <option value="totalPurchasesAmount">Achats</option>
            <option value="riskLevel">Risque</option>
            <option value="status">Statut</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Ordre</Label>
          <select id="sortOrder" name="sortOrder" defaultValue={filters.sortOrder ?? "desc"} className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-white px-3 text-sm">
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </select>
        </div>
        <div className="md:col-span-6">
          <Button type="submit">Filtrer</Button>
        </div>
      </form>

      <div className="rounded-xl border bg-white">
        {suppliers.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-muted-foreground)]">
            Aucun fournisseur pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° fournisseur</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Encours</TableHead>
                  <TableHead>Achats</TableHead>
                  <TableHead>Risque</TableHead>
                  <TableHead>Préféré</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.supplierNumber}</TableCell>
                    <TableCell>
                      <Link href={`/suppliers/${s.id}`} className="font-medium hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell><SupplierTypeBadge type={s.type} /></TableCell>
                    <TableCell><SupplierStatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-sm">{s.category?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{s.email ?? "—"}</TableCell>
                    <TableCell className="text-sm">{s.phone ?? "—"}</TableCell>
                    <TableCell>{getPrimaryCity(s.addresses) ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.tagAssignments.map((a) => (
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
                    <TableCell>{formatCurrency(s.outstandingAmount, s.currency)}</TableCell>
                    <TableCell>{formatCurrency(s.totalPurchasesAmount, s.currency)}</TableCell>
                    <TableCell><SupplierRiskBadge riskLevel={s.riskLevel} /></TableCell>
                    <TableCell>
                      {s.isPreferred ? (
                        <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-label="Préféré" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDateShort(s.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/suppliers/${s.id}`}>Voir</Link>
                          </DropdownMenuItem>
                          <PermissionGate user={user} permission="SUPPLIERS_UPDATE">
                            <DropdownMenuItem asChild>
                              <Link href={`/suppliers/${s.id}/edit`}>Modifier</Link>
                            </DropdownMenuItem>
                          </PermissionGate>
                          <DropdownMenuSeparator />
                          <PermissionGate user={user} permission="SUPPLIERS_DELETE">
                            {s.isArchived ? (
                              <DropdownMenuItem onClick={() => handleReactivate(s.id)}>
                                Réactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleArchive(s.id)}>
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
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {total} fournisseur{total > 1 ? "s" : ""} — Page {page}/{totalPages}
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
