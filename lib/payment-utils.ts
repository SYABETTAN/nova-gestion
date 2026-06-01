import type { Payment, PaymentMethod, PaymentStatus } from "@prisma/client";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payment-status";
import { moneyAdd, moneyToNumber } from "@/lib/money";

export const PAYMENT_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CREATED: "Paiement créé",
  UPDATED: "Paiement modifié",
  CONFIRMED: "Paiement confirmé",
  ALLOCATED: "Allocation effectuée",
  DEALLOCATED: "Désallocation effectuée",
  PARTIALLY_ALLOCATED: "Paiement partiellement alloué",
  FULLY_ALLOCATED: "Paiement totalement alloué",
  RECEIPT_GENERATED: "Reçu généré",
  EMAIL_SIMULATED: "Notification email reçu",
  CANCELLED: "Paiement annulé",
  NOTE: "Note ajoutée",
};

export function computePaymentStats(
  payments: Pick<
    Payment,
    | "status"
    | "amount"
    | "allocatedAmount"
    | "unallocatedAmount"
    | "method"
    | "paymentDate"
  >[],
) {
  const active = payments.filter((p) => p.status !== "CANCELLED");
  const cancelled = payments.filter((p) => p.status === "CANCELLED").length;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalAmount = moneyToNumber(active.reduce((s, p) => moneyAdd(s, p.amount), moneyAdd(0, 0)));
  const totalAllocated = moneyToNumber(
    active.reduce((s, p) => moneyAdd(s, p.allocatedAmount), moneyAdd(0, 0)),
  );
  const totalUnallocated = moneyToNumber(
    active.reduce((s, p) => moneyAdd(s, p.unallocatedAmount), moneyAdd(0, 0)),
  );
  const thisMonth = active.filter((p) => p.paymentDate >= monthStart).length;
  const partiallyAllocated = active.filter(
    (p) => p.status === "PARTIALLY_ALLOCATED",
  ).length;
  const averagePayment = active.length > 0 ? totalAmount / active.length : 0;

  const byMethod: Record<PaymentMethod, number> = {
    BANK_TRANSFER: 0,
    CARD: 0,
    CHECK: 0,
    CASH: 0,
    DIRECT_DEBIT: 0,
    OTHER: 0,
  };
  for (const p of active) {
    byMethod[p.method] = moneyToNumber(moneyAdd(byMethod[p.method], p.amount));
  }

  return {
    total: payments.length,
    activeCount: active.length,
    totalAmount,
    totalAllocated,
    totalUnallocated,
    thisMonth,
    cancelled,
    partiallyAllocated,
    averagePayment,
    byMethod,
  };
}

export function statusFilterLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function methodFilterLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
