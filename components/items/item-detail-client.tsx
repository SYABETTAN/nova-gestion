"use client";

import Link from "next/link";
import { toast } from "sonner";
import { FileText, Receipt } from "lucide-react";
import type { ItemTag } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ItemStatusBadge, ItemTypeBadge, MarginBadge } from "@/components/items/item-badges";
import { ITEM_ACTIVITY_LABELS, RECURRING_INTERVAL_LABELS } from "@/lib/item-utils";
import { formatCurrency, formatVatRate, moneyToNumber } from "@/lib/pricing";
import { moneyAdd } from "@/lib/money";
import type { SessionUser } from "@/lib/permissions";
import { formatDate, formatDateShort } from "@/lib/utils";
import { archiveItemAction, reactivateItemAction } from "@/server/actions/item.actions";
import { assignItemTagAction, removeItemTagAction } from "@/server/actions/item-tag.actions";

type ItemDetail = NonNullable<Awaited<ReturnType<typeof import("@/server/actions/item.actions").getItemByIdAction>>>;

export function ItemDetailClient({ user, item, allTags }: { user: SessionUser; item: ItemDetail; allTags: ItemTag[] }) {
  const quoteCount = item.activities.filter((a) => a.type === "ADDED_TO_QUOTE").length;
  const invoiceCount = item.activities.filter((a) => a.type === "ADDED_TO_INVOICE").length;
  const soldQty = moneyToNumber(
    item.activities.reduce((s, a) => moneyAdd(s, a.quantity ?? 0), moneyAdd(0, 0)),
  );
  const fakeRevenue = moneyToNumber(
    item.activities
      .filter((a) => a.amount)
      .reduce((s, a) => moneyAdd(s, a.amount ?? 0), moneyAdd(0, 0)),
  );

  function placeholder(module: string) {
    toast.info(`Module ${module} non encore disponible dans cette `);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{item.name}</h1>
            <ItemStatusBadge status={item.status} />
            <ItemTypeBadge type={item.type} />
            {item.isRecurring && <Badge variant="secondary">Récurrent</Badge>}
            {item.isStockable && <Badge variant="outline">Stockable</Badge>}
          </div>
          <p className="mt-1 font-mono text-sm text-[var(--color-muted-foreground)]">{item.itemNumber} · {item.sku ?? "Sans SKU"}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tagAssignments.map((a) => (
              <span key={a.tag.id} className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: a.tag.color }}>{a.tag.name}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGate user={user} permission="ITEMS_UPDATE">
            <Button variant="outline" asChild><Link href={`/items/${item.id}/edit`}>Modifier</Link></Button>
          </PermissionGate>
          <Button variant="outline" onClick={() => placeholder("devis")}><FileText className="h-4 w-4" />Ajouter à un devis</Button>
          <Button variant="outline" onClick={() => placeholder("factures")}><Receipt className="h-4 w-4" />Ajouter à une facture</Button>
          <PermissionGate user={user} permission="ITEMS_DELETE">
            {item.isArchived ? (
              <Button variant="secondary" onClick={async () => { await reactivateItemAction(item.id); toast.success("Réactivé"); }}>Réactiver</Button>
            ) : (
              <Button variant="destructive" onClick={async () => { if (confirm("Archiver ?")) { await archiveItemAction(item.id); toast.success("Archivé"); } }}>Archiver</Button>
            )}
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Devis</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{quoteCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Factures</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{invoiceCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">CA estimé</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(fakeRevenue)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Qté vendue fictive</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{soldQty}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="pricing">Prix & marge</TabsTrigger>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="history">Historique prix ({item.priceHistory.length})</TabsTrigger>
          <TabsTrigger value="activity">Activités ({item.activities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Résumé</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <p>Catégorie : {item.category?.name ?? "—"}</p>
              <p>Unité : {item.unit ? `${item.unit.name} (${item.unit.symbol})` : "—"}</p>
              <p>Récurrence : {item.isRecurring ? RECURRING_INTERVAL_LABELS[item.recurringInterval ?? ""] ?? "Oui" : "Non"}</p>
              <p>Stock : {item.isStockable ? `${item.stockQuantity} (seuil ${item.stockAlertThreshold})` : "Non stockable"}</p>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Prix</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <p>HT : {formatCurrency(item.salePriceExcludingTax, item.currency)}</p>
              <p>TTC : {formatCurrency(item.salePriceIncludingTax, item.currency)}</p>
              <p>TVA : {formatVatRate(item.defaultVatRate)}</p>
              <p className="flex items-center gap-2">Marge : {formatCurrency(item.marginAmount, item.currency)} ({moneyToNumber(item.marginRate)} %) <MarginBadge marginRate={item.marginRate} /></p>
            </CardContent></Card>
          </div>
          <TagManager user={user} itemId={item.id} assigned={item.tagAssignments.map((a) => a.tag)} allTags={allTags} />
        </TabsContent>

        <TabsContent value="pricing">
          <Card><CardContent className="grid gap-3 pt-6 text-sm md:grid-cols-2">
            <p>Prix vente HT : {formatCurrency(item.salePriceExcludingTax, item.currency)}</p>
            <p>Prix TTC : {formatCurrency(item.salePriceIncludingTax, item.currency)}</p>
            <p>Coût revient HT : {formatCurrency(item.purchasePriceExcludingTax, item.currency)}</p>
            <p>Marge : {formatCurrency(item.marginAmount, item.currency)}</p>
            <p>Taux marge : {moneyToNumber(item.marginRate)} %</p>
            <p>Devise : {item.currency}</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="description">
          <Card><CardContent className="space-y-4 pt-6">
            <div><p className="font-medium">Description courte</p><p className="text-sm text-[var(--color-muted-foreground)]">{item.shortDescription ?? "—"}</p></div>
            <div><p className="font-medium">Description</p><p className="text-sm text-[var(--color-muted-foreground)]">{item.description ?? "—"}</p></div>
            <div><p className="font-medium">Notes internes</p><p className="text-sm text-[var(--color-muted-foreground)]">{item.notes ?? "—"}</p></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {item.priceHistory.map((h) => (
            <Card key={h.id}><CardContent className="pt-6 text-sm">
              <p>{formatDate(h.changedAt)} — {h.changedBy?.name ?? "Système"}</p>
              <p>Prix HT : {moneyToNumber(h.oldSalePriceExcludingTax)} € → {moneyToNumber(h.newSalePriceExcludingTax)} €</p>
              <p>Coût : {moneyToNumber(h.oldPurchasePriceExcludingTax)} € → {moneyToNumber(h.newPurchasePriceExcludingTax)} €</p>
              <p>TVA : {moneyToNumber(h.oldVatRate)} % → {moneyToNumber(h.newVatRate)} %</p>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="activity" className="space-y-3">
          {item.activities.map((a) => (
            <Card key={a.id}><CardContent className="pt-6">
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">{ITEM_ACTIVITY_LABELS[a.type] ?? a.type}</p>
              {a.description && <p className="text-sm">{a.description}</p>}
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{formatDate(a.activityDate)}{a.amount != null && ` · ${formatCurrency(a.amount, item.currency)}`}</p>
            </CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>

      {item.activities[0] && <p className="text-sm text-[var(--color-muted-foreground)]">Dernière activité : {item.activities[0].title} — {formatDateShort(item.activities[0].activityDate)}</p>}
    </div>
  );
}

function TagManager({ user, itemId, assigned, allTags }: { user: SessionUser; itemId: string; assigned: ItemTag[]; allTags: ItemTag[] }) {
  const assignedIds = new Set(assigned.map((t) => t.id));
  return (
    <Card><CardHeader><CardTitle>Tags</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
      {allTags.map((tag) => {
        const isAssigned = assignedIds.has(tag.id);
        return (
          <PermissionGate key={tag.id} user={user} permission="ITEMS_UPDATE">
            <button type="button" className={`rounded-full px-3 py-1 text-xs text-white ${isAssigned ? "ring-2 ring-blue-500 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: tag.color }}
              onClick={async () => {
                const r = isAssigned ? await removeItemTagAction(itemId, tag.id) : await assignItemTagAction(itemId, tag.id);
                if (r.success) toast.success(isAssigned ? "Tag retiré" : "Tag assigné");
              }}>{tag.name}</button>
          </PermissionGate>
        );
      })}
    </CardContent></Card>
  );
}
