import type { DocumentStatus, DocumentType } from "@prisma/client";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  QUOTE: "Devis",
  INVOICE: "Facture client",
  CREDIT_NOTE: "Avoir",
  PAYMENT_RECEIPT: "Reçu de paiement",
  REMINDER: "Relance",
  SUPPLIER_INVOICE: "Facture fournisseur",
  SUPPLIER_ATTACHMENT: "Pièce jointe fournisseur",
  ACCOUNTING_EXPORT: "Export comptable",
  DASHBOARD_EXPORT: "Export tableau de bord",
  CUSTOMER_EXPORT: "Export clients",
  SUPPLIER_EXPORT: "Export fournisseurs",
  OTHER: "Autre",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Brouillon",
  GENERATED: "Généré",
  DOWNLOADED: "Téléchargé",
  ARCHIVED: "Archivé",
};

export const MIME_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "text/csv": "CSV",
  "application/json": "JSON",
  "text/plain": "Texte",
  "image/png": "Image PNG",
  "image/jpeg": "Image JPEG",
};

export function getDocumentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

export function getDocumentStatusLabel(status: DocumentStatus): string {
  return DOCUMENT_STATUS_LABELS[status] ?? status;
}

export function getMimeTypeLabel(mimeType: string): string {
  return MIME_TYPE_LABELS[mimeType] ?? mimeType;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
