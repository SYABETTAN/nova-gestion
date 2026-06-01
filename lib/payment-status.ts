import type { PaymentMethod, PaymentStatus } from "@prisma/client";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmé",
  PARTIALLY_ALLOCATED: "Partiellement alloué",
  FULLY_ALLOCATED: "Totalement alloué",
  CANCELLED: "Annulé",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Virement",
  CARD: "Carte",
  CHECK: "Chèque",
  CASH: "Espèces",
  DIRECT_DEBIT: "Prélèvement",
  OTHER: "Autre",
};

export function formatPaymentStatus(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function formatPaymentMethod(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

export function computePaymentStatusFromAmounts(
  amount: number,
  allocatedAmount: number,
): PaymentStatus {
  if (allocatedAmount <= 0) return "CONFIRMED";
  if (allocatedAmount >= amount) return "FULLY_ALLOCATED";
  return "PARTIALLY_ALLOCATED";
}

export function canEditPayment(status: PaymentStatus): boolean {
  return status !== "CANCELLED";
}

export function canAllocatePayment(status: PaymentStatus): boolean {
  return status !== "CANCELLED";
}

export function canCancelPayment(status: PaymentStatus): boolean {
  return status !== "CANCELLED";
}
