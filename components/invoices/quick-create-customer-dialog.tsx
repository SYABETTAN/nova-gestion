"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerSelectOption } from "@/components/shared/customer-search-select";
import { quickCreateCustomerAction } from "@/server/actions/customer.actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (customer: CustomerSelectOption) => void;
};

export function QuickCreateCustomerDialog({ open, onOpenChange, initialName, onCreated }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("type", "COMPANY");
    fd.set("status", "ACTIVE");
    setLoading(true);
    const result = await quickCreateCustomerAction(fd);
    setLoading(false);
    if (result.success) {
      toast.success("Client créé");
      onCreated(result.customer as CustomerSelectOption);
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
          <DialogTitle>Créer un client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qc-name">Société / Nom *</Label>
            <Input id="qc-name" name="name" defaultValue={initialName} required minLength={2} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-email">Email</Label>
              <Input id="qc-email" name="email" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-phone">Téléphone</Label>
              <Input id="qc-phone" name="phone" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-siret">SIREN / SIRET</Label>
            <Input id="qc-siret" name="siret" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-address">Adresse</Label>
            <Input id="qc-address" name="addressLine1" placeholder="N° et rue" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-postal">Code postal</Label>
              <Input id="qc-postal" name="postalCode" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-city">Ville</Label>
              <Input id="qc-city" name="city" />
            </div>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            L&apos;adresse est enregistrée si le code postal et la ville sont renseignés.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Création…" : "Créer le client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
