import { isProduction } from "@/lib/env";

export const FEATURE_MESSAGES = {
  emailNotConfigured:
    "L'envoi par email n'est pas configuré. Définissez EMAIL_PROVIDER, EMAIL_FROM et RESEND_API_KEY.",
  invitationsNotConfigured:
    "L'envoi par email n'est pas configuré. Définissez EMAIL_PROVIDER, EMAIL_FROM et RESEND_API_KEY.",
  fileUploadNotConfigured:
    "Le stockage de fichiers n'est pas configuré. Définissez STORAGE_PROVIDER et STORAGE_PATH (local) ou les variables S3.",
  paymentUseModule: "Utilisez le module Paiements pour enregistrer un règlement.",
  supplierPaymentUseModule:
    "Utilisez le module Paiements fournisseurs pour enregistrer un règlement.",
} as const;

export type BlockedActionResult = { success: false; error: string };

export function simulatedActionsAllowed(): boolean {
  return !isProduction();
}

export function blockSimulatedActionInProduction(
  message: string = FEATURE_MESSAGES.emailNotConfigured,
): BlockedActionResult | null {
  if (isProduction()) {
    return { success: false, error: message };
  }
  return null;
}
