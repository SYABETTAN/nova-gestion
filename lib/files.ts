/** Chemin API pour télécharger un document (authentification requise). */
export function getDocumentApiPath(documentId: string): string {
  return `/api/files/${documentId}`;
}

/** Chemin API pour une pièce jointe facture fournisseur. */
export function getSupplierAttachmentApiPath(attachmentId: string): string {
  return `/api/files/supplier-attachment/${attachmentId}`;
}
