"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemSelectOption } from "@/lib/items";
import { quickCreateItemAction } from "@/server/actions/item.actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (item: ItemSelectOption) => void;
};

export function QuickCreateItemDialog({ open, onOpenChange, initialName, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"SERVICE" | "PRODUCT">("SERVICE");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("type", type);
    fd.set("status", "ACTIVE");
    if (type === "PRODUCT") fd.set("isStockable", "true");
    setLoading(true);
    const result = await quickCreateItemAction(fd);
    setLoading(false);
    if (result.success) {
      toast.success("Article créé");
      onCreated(result.item);
      onOpenChange(false);
      form.reset();
    } else {
      toast.error(result.error ?? "Création impossible");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un article</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qi-name">Désignation *</Label>
            <Input id="qi-name" name="name" defaultValue={initialName} required minLength={2} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qi-ref">Référence (code)</Label>
              <Input id="qi-ref" name="itemNumber" placeholder="Auto si vide" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex h-10 items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="type-ui"
                    checked={type === "SERVICE"}
                    onChange={() => setType("SERVICE")}
                  />
                  Service
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="type-ui"
                    checked={type === "PRODUCT"}
                    onChange={() => setType("PRODUCT")}
                  />
                  Produit
                </label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qi-price">Prix HT *</Label>
              <Input
                id="qi-price"
                name="salePriceExcludingTax"
                type="number"
                min={0}
                step={0.01}
                defaultValue={0}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qi-vat">TVA %</Label>
              <Input id="qi-vat" name="defaultVatRate" type="number" min={0} max={100} defaultValue={20} />
            </div>
            {type === "PRODUCT" && (
              <div className="space-y-1.5">
                <Label htmlFor="qi-stock">Stock</Label>
                <Input id="qi-stock" name="stockQuantity" type="number" min={0} defaultValue={0} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Création…" : "Créer l'article"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
