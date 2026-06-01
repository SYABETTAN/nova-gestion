"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REMINDER_LEVEL_LABELS } from "@/lib/reminder-utils";
import {
  getInvoiceReminderPreviewAction,
  sendReminderEmailAction,
} from "@/server/actions/reminder.actions";

type ReminderSendDialogProps = {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ReminderSendDialog({
  invoiceId,
  open,
  onOpenChange,
  onSuccess,
}: ReminderSendDialogProps) {
  const [loading, setLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [level, setLevel] = useState("FRIENDLY");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [internalNotes, setInternalNotes] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof getInvoiceReminderPreviewAction>>>(null);

  useEffect(() => {
    if (!open || !invoiceId) return;
    getInvoiceReminderPreviewAction(invoiceId).then((data) => {
      setPreview(data);
      if (data) {
        setRecipientEmail(data.recipientEmail);
        setLevel(data.level);
        setSubject(data.subject);
        setMessage(data.message);
      }
    });
  }, [open, invoiceId]);

  async function handleSend() {
    if (!invoiceId) return;
    setLoading(true);
    const result = await sendReminderEmailAction({
      invoiceId,
      recipientEmail,
      level: level as "FRIENDLY" | "FIRST_NOTICE" | "SECOND_NOTICE" | "FINAL_NOTICE",
      channel: "EMAIL",
      subject,
      message,
      includePaymentLinkPlaceholder: includePaymentLink,
      internalNotes: internalNotes || null,
    });
    setLoading(false);
    if (result.success) {
      toast.success(result.message);
      onOpenChange(false);
      onSuccess?.();
    } else toast.error(result.error ?? "Erreur");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Envoyer une relance</DialogTitle>
        </DialogHeader>
        {preview && !preview.eligible && (
          <p className="text-sm text-destructive">Cette facture n{"'"}est pas éligible à la relance.</p>
        )}
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p><strong>Facture :</strong> {preview?.invoiceNumber}</p>
            <p><strong>Client :</strong> {preview?.customerName}</p>
            <p><strong>Retard :</strong> {preview?.daysOverdue} jour(s) — <strong>Reste dû :</strong> {preview?.amountDue?.toFixed(2)} €</p>
          </div>
          <div className="space-y-2">
            <Label>Destinataire</Label>
            <Input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Niveau</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REMINDER_LEVEL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Objet</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={10} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includePaymentLink} onChange={(e) => setIncludePaymentLink(e.target.checked)} />
            Inclure un lien de paiement
          </label>
          <div className="space-y-2">
            <Label>Notes internes</Label>
            <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSend} disabled={loading || !preview?.eligible}>
              {loading ? "Envoi..." : "Envoyer la relance"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
