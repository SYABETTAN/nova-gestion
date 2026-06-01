"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ItemCategory, ItemTag, ItemUnit } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { MarginBadge } from "@/components/items/item-badges";
import { computeItemPricing, formatCurrency, formatVatRate } from "@/lib/pricing";
import { createItemAction, updateItemAction } from "@/server/actions/item.actions";
import { moneyToNumber, type MoneyInput } from "@/lib/money";

type ItemFormProps = {
  mode: "create" | "edit";
  item?: {
    type?: string;
    status?: string;
    name?: string;
    sku?: string | null;
    description?: string | null;
    shortDescription?: string | null;
    categoryId?: string | null;
    unitId?: string | null;
    imageUrl?: string | null;
    barcode?: string | null;
    defaultVatRate?: MoneyInput;
    salePriceExcludingTax?: MoneyInput;
    purchasePriceExcludingTax?: MoneyInput;
    currency?: string;
    isRecurring?: boolean;
    recurringInterval?: string | null;
    isStockable?: boolean;
    stockQuantity?: MoneyInput;
    stockAlertThreshold?: MoneyInput;
    notes?: string | null;
    tagAssignments?: { tagId: string }[];
  };
  itemId?: string;
  categories: ItemCategory[];
  units: ItemUnit[];
  tags: ItemTag[];
};

export function ItemForm({ mode, item, itemId, categories, units, tags }: ItemFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(item?.type ?? "SERVICE");
  const [status, setStatus] = useState(item?.status ?? "ACTIVE");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "");
  const [unitId, setUnitId] = useState(item?.unitId ?? "");
  const [recurringInterval, setRecurringInterval] = useState(item?.recurringInterval ?? "");
  const [isRecurring, setIsRecurring] = useState(item?.isRecurring ?? false);
  const [isStockable, setIsStockable] = useState(item?.isStockable ?? false);
  const [saleHT, setSaleHT] = useState(moneyToNumber(item?.salePriceExcludingTax ?? 0));
  const [purchaseHT, setPurchaseHT] = useState(moneyToNumber(item?.purchasePriceExcludingTax ?? 0));
  const [vatRate, setVatRate] = useState(moneyToNumber(item?.defaultVatRate ?? 20));

  const selectedTagIds = item?.tagAssignments?.map((a) => a.tagId) ?? [];

  const pricing = useMemo(
    () =>
      computeItemPricing({
        salePriceExcludingTax: saleHT,
        purchasePriceExcludingTax: purchaseHT,
        defaultVatRate: vatRate,
      }),
    [saleHT, purchaseHT, vatRate],
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("type", type);
    formData.set("status", status);
    formData.set("categoryId", categoryId);
    formData.set("unitId", unitId);
    formData.set("isRecurring", String(isRecurring));
    formData.set("isStockable", String(isStockable));
    if (recurringInterval) formData.set("recurringInterval", recurringInterval);
    formData.set("tagIds", (formData.getAll("tagCheckbox") as string[]).join(","));

    const result =
      mode === "create"
        ? await createItemAction(formData)
        : await updateItemAction(itemId!, formData);

    setLoading(false);
    if (result.success) {
      toast.success(mode === "create" ? "Article créé" : "Article mis à jour");
      if (mode === "create" && "itemId" in result && result.itemId) {
        router.push(`/items/${result.itemId}`);
      } else {
        router.push(`/items/${itemId}`);
      }
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Identification</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SERVICE">Service</SelectItem>
                <SelectItem value="PRODUCT">Produit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Brouillon</SelectItem>
                <SelectItem value="ACTIVE">Actif</SelectItem>
                <SelectItem value="INACTIVE">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Nom *</Label>
            <Input id="name" name="name" defaultValue={item?.name ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">Référence SKU</Label>
            <Input id="sku" name="sku" defaultValue={item?.sku ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">Code-barres</Label>
            <Input id="barcode" name="barcode" defaultValue={item?.barcode ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="shortDescription">Description courte</Label>
            <Input id="shortDescription" name="shortDescription" defaultValue={item?.shortDescription ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description longue</Label>
            <Textarea id="description" name="description" defaultValue={item?.description ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="imageUrl">Image URL fictive</Label>
            <Input id="imageUrl" name="imageUrl" defaultValue={item?.imageUrl ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Classification</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unité</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.symbol})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="tagCheckbox" value={tag.id} defaultChecked={selectedTagIds.includes(tag.id)} />
                <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Prix</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Input id="currency" name="currency" defaultValue={item?.currency ?? "EUR"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultVatRate">TVA (%)</Label>
            <Input id="defaultVatRate" name="defaultVatRate" type="number" min={0} max={100} value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salePriceExcludingTax">Prix vente HT</Label>
            <Input id="salePriceExcludingTax" name="salePriceExcludingTax" type="number" min={0} step="0.01" value={saleHT} onChange={(e) => setSaleHT(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchasePriceExcludingTax">Coût revient HT</Label>
            <Input id="purchasePriceExcludingTax" name="purchasePriceExcludingTax" type="number" min={0} step="0.01" value={purchaseHT} onChange={(e) => setPurchaseHT(Number(e.target.value))} />
          </div>
          <div className="md:col-span-2 rounded-lg bg-slate-50 p-4 text-sm">
            <p>Prix TTC : <strong>{formatCurrency(pricing.salePriceIncludingTax)}</strong></p>
            <p>TVA : {formatVatRate(vatRate)}</p>
            <p className="flex items-center gap-2">
              Marge : <strong>{formatCurrency(pricing.marginAmount)}</strong> ({pricing.marginRate} %)
              <MarginBadge marginRate={pricing.marginRate} />
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Récurrence & stock</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Article récurrent
          </label>
          {isRecurring && (
            <Select value={recurringInterval} onValueChange={setRecurringInterval}>
              <SelectTrigger><SelectValue placeholder="Intervalle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Mensuel</SelectItem>
                <SelectItem value="QUARTERLY">Trimestriel</SelectItem>
                <SelectItem value="YEARLY">Annuel</SelectItem>
              </SelectContent>
            </Select>
          )}
          {type === "PRODUCT" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isStockable} onChange={(e) => setIsStockable(e.target.checked)} />
                Stockable
              </label>
              {isStockable && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="stockQuantity">Quantité stock</Label>
                    <Input id="stockQuantity" name="stockQuantity" type="number" min={0} defaultValue={item?.stockQuantity != null ? moneyToNumber(item.stockQuantity) : 0} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stockAlertThreshold">Seuil alerte</Label>
                    <Input id="stockAlertThreshold" name="stockAlertThreshold" type="number" min={0} defaultValue={item?.stockAlertThreshold != null ? moneyToNumber(item.stockAlertThreshold) : 0} />
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes internes</CardTitle></CardHeader>
        <CardContent>
          <Textarea name="notes" defaultValue={item?.notes ?? ""} placeholder="Notes internes..." />
        </CardContent>
      </Card>

      <Separator />
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>{loading ? "Enregistrement..." : mode === "create" ? "Créer" : "Enregistrer"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
      </div>
    </form>
  );
}
