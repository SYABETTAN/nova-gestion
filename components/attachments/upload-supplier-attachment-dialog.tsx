"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadSupplierInvoiceAttachmentAction } from "@/server/actions/supplier-invoice-attachment.actions";

export function UploadSupplierAttachmentDialog({
  supplierInvoiceId,
}: {
  supplierInvoiceId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachmentType, setAttachmentType] = useState("INVOICE_PDF");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("type", attachmentType);

    const result = await uploadSupplierInvoiceAttachmentAction(supplierInvoiceId, formData);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error ?? "Échec du téléversement");
      return;
    }

    toast.success("Pièce jointe enregistrée");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Ajouter une pièce jointe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Téléverser une pièce jointe</DialogTitle>
            <DialogDescription>
              PDF, images ou documents bureautiques (max. 15 Mo). Le fichier est stocké de façon
              sécurisée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="attachment-file">Fichier</Label>
              <Input
                id="attachment-file"
                name="file"
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.doc,.docx,.xls,.xlsx,.zip"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={attachmentType} onValueChange={setAttachmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INVOICE_PDF">Facture PDF</SelectItem>
                  <SelectItem value="RECEIPT">Reçu / justificatif</SelectItem>
                  <SelectItem value="CONTRACT">Contrat</SelectItem>
                  <SelectItem value="OTHER">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Envoi…" : "Téléverser"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
