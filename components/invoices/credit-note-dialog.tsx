"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCreditNoteFromInvoiceAction } from "@/server/actions/credit-note.actions";
import { moneyToNumber, type MoneyInput } from "@/lib/money";

type CreditNoteDialogProps = {
  invoiceId: string;
  invoiceNumber: string;
  totalIncludingTax: MoneyInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (creditNoteId: string) => void;
};

export function CreditNoteDialog({
  invoiceId,
  invoiceNumber,
  totalIncludingTax,
  open,
  onOpenChange,
  onSuccess,
}: CreditNoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"TOTAL" | "PARTIAL">("TOTAL");
  const [reason, setReason] = useState("");
  const [partialAmount, setPartialAmount] = useState(0);

  async function handleCreate() {
    setLoading(true);
    const formData = new FormData();
    formData.set("type", type);
    formData.set("reason", reason);
    if (type === "PARTIAL") formData.set("partialAmount", String(partialAmount));
    const result = await createCreditNoteFromInvoiceAction(invoiceId, formData);
    setLoading(false);
    if (result.success && result.creditNoteId) {
      toast.success(result.message ?? "Avoir créé");
      onOpenChange(false);
      onSuccess?.(result.creditNoteId);
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un avoir — {invoiceNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type d{"'"}avoir</Label>
            <Select value={type} onValueChange={(v) => setType(v as "TOTAL" | "PARTIAL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TOTAL">Avoir total</SelectItem>
                <SelectItem value="PARTIAL">Avoir partiel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Raison *</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          {type === "PARTIAL" && (
            <div className="space-y-2">
              <Label htmlFor="partialAmount">Montant TTC</Label>
              <Input
                id="partialAmount"
                type="number"
                min={0}
                max={moneyToNumber(totalIncludingTax)}
                step={0.01}
                value={partialAmount}
                onChange={(e) => setPartialAmount(Number(e.target.value))}
              />
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Maximum : {moneyToNumber(totalIncludingTax).toFixed(2)} €
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={loading || reason.length < 2}>
            {loading ? "Création..." : "Créer l'avoir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
