"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, MoreHorizontal, Plus } from "lucide-react";
import type { ItemCategory, ItemTag } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ItemStatusBadge, ItemTypeBadge, MarginBadge } from "@/components/items/item-badges";
import { formatCurrency, formatVatRate } from "@/lib/pricing";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemsSalesPanel } from "@/components/items/items-sales-panel";
import type { ItemSalesReport, ItemStockSummary } from "@/lib/item-sales";
import { archiveItemAction, exportItemsCsvAction, reactivateItemAction } from "@/server/actions/item.actions";

type ItemRow = {
  id: string;
  itemNumber: string;
  sku: string | null;
  name: string;
  type: "PRODUCT" | "SERVICE";
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  defaultVatRate: MoneyInput;
  salePriceExcludingTax: MoneyInput;
  salePriceIncludingTax: MoneyInput;
  marginAmount: MoneyInput;
  marginRate: MoneyInput;
  currency: string;
  isRecurring: boolean;
  isStockable: boolean;
  isArchived: boolean;
  createdAt: Date;
  category: { name: string } | null;
  tagAssignments: { tag: { id: string; name: string; color: string } }[];
};

type Stats = {
  total: number;
  activeProducts: number;
  activeServices: number;
  averageSalePrice: number;
  averageMarginRate: number;
};

type ItemsPageClientProps = {
  user: SessionUser;
  items: ItemRow[];
  stockSummaries?: Record<string, ItemStockSummary>;
  categories: ItemCategory[];
  tags: ItemTag[];
  stats: Stats;
  total: number;
  page: number;
  totalPages: number;
  filters: Record<string, string | undefined>;
  activeTab?: string;
  salesReport?: ItemSalesReport | null;
};

export function ItemsPageClient({
  user,
  items,
  stockSummaries = {},
  categories,
  tags,
  stats,
  total,
  page,
  totalPages,
  filters,
  activeTab = "catalog",
  salesReport,
}: ItemsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    if (!updates.page) params.set("page", "1");
    return `/items?${params.toString()}`;
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportItemsCsvAction(Object.fromEntries(searchParams.entries()));
    setExporting(false);
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "catalogue.csv";
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
            <h1 className="text-2xl font-bold">Articles & services</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">Gérez votre catalogue — données fictives</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />{exporting ? "Export..." : "Exporter CSV"}
          </Button>
          <PermissionGate user={user} permission="ITEMS_CREATE">
            <Button asChild><Link href="/items/new"><Plus className="h-4 w-4" />Nouvel article / service</Link></Button>
          </PermissionGate>
        </div>
      </div>

      <Tabs value={activeTab}>
        <TabsList>
          <TabsTrigger value="catalog" asChild><Link href="/items?tab=catalog">Catalogue</Link></TabsTrigger>
          <TabsTrigger value="sales" asChild><Link href="/items?tab=sales">Ventes par période</Link></TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Total", stats.total],
          ["Produits actifs", stats.activeProducts],
          ["Services actifs", stats.activeServices],
          ["Prix moyen HT", formatCurrency(stats.averageSalePrice)],
          ["Marge moyenne", `${stats.averageMarginRate.toFixed(1)} %`],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <form method="get" className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-4 lg:grid-cols-6">
        <input type="hidden" name="tab" value="catalog" />
        <div className="space-y-2 md:col-span-2"><Label htmlFor="q">Recherche</Label><Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Nom, SKU, code-barres..." /></div>
        <div className="space-y-2"><Label htmlFor="type">Type</Label>
          <select id="type" name="type" defaultValue={filters.type ?? ""} className="flex h-10 w-full rounded-md border px-3 text-sm">
            <option value="">Tous</option><option value="PRODUCT">Produit</option><option value="SERVICE">Service</option>
          </select></div>
        <div className="space-y-2"><Label htmlFor="status">Statut</Label>
          <select id="status" name="status" defaultValue={filters.status ?? ""} className="flex h-10 w-full rounded-md border px-3 text-sm">
            <option value="">Tous</option><option value="DRAFT">Brouillon</option><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option><option value="ARCHIVED">Archivé</option>
          </select></div>
        <div className="space-y-2"><Label htmlFor="categoryId">Catégorie</Label>
          <select id="categoryId" name="categoryId" defaultValue={filters.categoryId ?? ""} className="flex h-10 w-full rounded-md border px-3 text-sm">
            <option value="">Toutes</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="space-y-2"><Label htmlFor="tagId">Étiquette produit</Label>
          <select id="tagId" name="tagId" defaultValue={filters.tagId ?? ""} className="flex h-10 w-full rounded-md border px-3 text-sm">
            <option value="">Toutes</option>{tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        <div className="space-y-2"><Label htmlFor="archived">Archivés</Label>
          <select id="archived" name="archived" defaultValue={filters.archived ?? "false"} className="flex h-10 w-full rounded-md border px-3 text-sm">
            <option value="false">Actifs</option><option value="only">Archivés</option><option value="true">Tous</option>
          </select></div>
        <div className="md:col-span-6"><Button type="submit">Filtrer</Button></div>
      </form>

      <div className="rounded-xl border bg-white">
        {items.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-muted-foreground)]">Aucun article ou service pour le moment.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead><TableHead>SKU</TableHead><TableHead>Nom</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead>
                <TableHead>Catégorie</TableHead><TableHead>Stock</TableHead><TableHead>Vendu</TableHead><TableHead>Restant</TableHead><TableHead>Achat HT</TableHead><TableHead>Prix HT</TableHead><TableHead>TVA</TableHead><TableHead>Prix TTC</TableHead><TableHead>Marge</TableHead><TableHead>Étiquettes</TableHead><TableHead>Créé</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const stock = stockSummaries[item.id];
                return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.itemNumber}</TableCell>
                  <TableCell className="text-xs">{item.sku ?? "—"}</TableCell>
                  <TableCell><Link href={`/items/${item.id}`} className="font-medium hover:underline">{item.name}</Link></TableCell>
                  <TableCell><ItemTypeBadge type={item.type} /></TableCell>
                  <TableCell><ItemStatusBadge status={item.status} /></TableCell>
                  <TableCell>{item.category?.name ?? "—"}</TableCell>
                  <TableCell>{item.isStockable ? stock?.stockInitial ?? 0 : "—"}</TableCell>
                  <TableCell>{stock?.quantitySold ?? 0}</TableCell>
                  <TableCell>{item.isStockable ? stock?.quantityRemaining ?? 0 : "—"}</TableCell>
                  <TableCell>{formatCurrency(stock?.purchasePriceExcludingTax ?? 0, item.currency)}</TableCell>
                  <TableCell>{formatCurrency(item.salePriceExcludingTax, item.currency)}</TableCell>
                  <TableCell>{formatVatRate(item.defaultVatRate)}</TableCell>
                  <TableCell>{formatCurrency(item.salePriceIncludingTax, item.currency)}</TableCell>
                  <TableCell><span className="flex items-center gap-1">{formatCurrency(item.marginAmount, item.currency)}<MarginBadge marginRate={item.marginRate} /></span></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{item.tagAssignments.map((a) => <span key={a.tag.id} className="rounded-full px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: a.tag.color }}>{a.tag.name}</span>)}</div></TableCell>
                  <TableCell className="text-sm">{formatDateShort(item.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/items/${item.id}`}>Voir</Link></DropdownMenuItem>
                        <PermissionGate user={user} permission="ITEMS_UPDATE"><DropdownMenuItem asChild><Link href={`/items/${item.id}/edit`}>Modifier</Link></DropdownMenuItem></PermissionGate>
                        <DropdownMenuSeparator />
                        <PermissionGate user={user} permission="ITEMS_DELETE">
                          {item.isArchived ? (
                            <DropdownMenuItem onClick={async () => { await reactivateItemAction(item.id); toast.success("Réactivé"); }}>Réactiver</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={async () => { if (confirm("Archiver ?")) { await archiveItemAction(item.id); toast.success("Archivé"); } }}>Archiver</DropdownMenuItem>
                          )}
                        </PermissionGate>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">{total} articles — Page {page}/{totalPages}</p>
          <div className="flex gap-2">
            {page > 1 && <Button variant="outline" size="sm" onClick={() => router.push(buildUrl({ page: String(page - 1) }))}>Précédent</Button>}
            {page < totalPages && <Button variant="outline" size="sm" onClick={() => router.push(buildUrl({ page: String(page + 1) }))}>Suivant</Button>}
          </div>
        </div>
      )}
        </TabsContent>

        <TabsContent value="sales">
          {salesReport && (
            <ItemsSalesPanel
              report={salesReport}
              filters={{ from: filters.from, to: filters.to, customerId: filters.customerId }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
