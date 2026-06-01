import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, string> = {
  INVOICE_PDF: "Facture PDF",
  RECEIPT: "Justificatif",
  CONTRACT: "Contrat",
  OTHER: "Autre",
};

export function AttachmentTypeBadge({ type }: { type: string }) {
  return <Badge variant="outline">{LABELS[type] ?? type}</Badge>;
}
