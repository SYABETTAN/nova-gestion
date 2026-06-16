export type InvoicePaymentPrefillError =
  | "NOT_FOUND"
  | "ARCHIVED"
  | "ALREADY_PAID"
  | "NOT_PAYABLE"
  | "ZERO_DUE";

export function invoicePaymentPrefillErrorMessage(error: InvoicePaymentPrefillError): string {
  switch (error) {
    case "NOT_FOUND":
      return "Facture introuvable ou inaccessible.";
    case "ARCHIVED":
      return "Cette facture est archivée.";
    case "ALREADY_PAID":
      return "Cette facture est déjà entièrement payée.";
    case "NOT_PAYABLE":
      return "Cette facture ne peut pas recevoir de paiement dans son état actuel.";
    case "ZERO_DUE":
      return "Aucun montant restant dû sur cette facture.";
    default:
      return "Impossible de préparer le paiement.";
  }
}
