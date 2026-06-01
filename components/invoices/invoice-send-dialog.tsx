"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendInvoiceEmailAction } from "@/server/actions/invoice-status.actions";

type InvoiceSendDialogProps = {
  invoiceId: string;
  invoiceNumber: string;
  defaultRecipient?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function InvoiceSendDialog({
  invoiceId,
  invoiceNumber,
  defaultRecipient,
  open,
  onOpenChange,
  onSuccess,
}: InvoiceSendDialogProps) {
  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState(defaultRecipient ?? "");
  const [subject, setSubject] = useState(`Facture ${invoiceNumber} — Nova Gestion`);
  const [message, setMessage] = useState(
    "Bonjour,\n\nVeuillez trouver ci-joint notre facture. Merci de procéder au règlement avant la date d'échéance.\n\nCordialement,\nL'équipe Nova Gestion",
  );

  async function handleSend() {
    setLoading(true);
    const formData = new FormData();
    formData.set("recipient", recipient);
    formData.set("subject", subject);
    formData.set("message", message);
    const result = await sendInvoiceEmailAction(invoiceId, formData);
    setLoading(false);
    if (result.success) {
      toast.success(result.message ?? "Facture envoyée par email");
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer la facture par email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Destinataire</Label>
            <Input id="recipient" type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Objet</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            L&apos;email sera envoyé selon votre configuration (Resend en production, journal en développement).
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSend} disabled={loading}>{loading ? "Envoi..." : "Envoyer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
