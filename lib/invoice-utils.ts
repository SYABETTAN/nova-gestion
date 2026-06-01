import type { Invoice, InvoicePaymentStatus, InvoiceStatus } from "@prisma/client";
import { formatInvoiceStatus, formatPaymentStatus } from "@/lib/invoice-status";
import { moneyAdd, moneyToNumber } from "@/lib/money";

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function computeInvoiceStats(
  invoices: Pick<
    Invoice,
    "status" | "paymentStatus" | "totalIncludingTax" | "amountPaid" | "amountDue" | "isArchived"
  >[],
) {
  const active = invoices.filter((i) => !i.isArchived);
  const drafts = active.filter((i) => i.status === "DRAFT").length;
  const validatedOrSent = active.filter((i) =>
    ["VALIDATED", "SENT"].includes(i.status),
  ).length;
  const paid = active.filter((i) => i.status === "PAID").length;
  const overdue = active.filter(
    (i) => i.status === "OVERDUE" || i.paymentStatus === "OVERDUE",
  ).length;
  const toCollect = moneyToNumber(
    active
      .filter((i) => !["PAID", "CANCELLED", "CREDITED", "DRAFT"].includes(i.status))
      .reduce((sum, i) => moneyAdd(sum, i.amountDue), moneyAdd(0, 0)),
  );
  const totalInvoiced = moneyToNumber(
    active
      .filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED")
      .reduce((sum, i) => moneyAdd(sum, i.totalIncludingTax), moneyAdd(0, 0)),
  );
  const totalPaid = moneyToNumber(
    active.reduce((sum, i) => moneyAdd(sum, i.amountPaid), moneyAdd(0, 0)),
  );
  const totalUnpaid = moneyToNumber(
    active
      .filter((i) => !["PAID", "CANCELLED", "CREDITED"].includes(i.status))
      .reduce((sum, i) => moneyAdd(sum, i.amountDue), moneyAdd(0, 0)),
  );
  const validatedCount = active.filter((i) => i.status !== "DRAFT").length;
  const averageBasket = validatedCount > 0 ? totalInvoiced / validatedCount : 0;

  return {
    total: active.length,
    drafts,
    validatedOrSent,
    paid,
    overdue,
    toCollect,
    totalInvoiced,
    totalPaid,
    totalUnpaid,
    averageBasket,
  };
}

export const INVOICE_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CREATED: "Facture créée",
  UPDATED: "Facture modifiée",
  VALIDATED: "Facture validée",
  SENT: "Facture envoyée",
  EMAIL_SIMULATED: "Email (non configuré) envoyé",
  PDF_GENERATED: "PDF généré",
  MARKED_OVERDUE: "Facture en retard",
  MARKED_PAID_PLACEHOLDER: "Paiement enregistré",
  PARTIAL_PAYMENT_PLACEHOLDER: "Paiement partiel enregistré",
  CANCELLED: "Facture annulée",
  CREDIT_NOTE_CREATED: "Avoir créé",
  ARCHIVED: "Facture archivée",
  REACTIVATED: "Facture réactivée",
  CREATED_FROM_QUOTE: "Créée depuis devis",
  NOTE: "Note ajoutée",
  PAYMENT_RECEIVED: "Paiement reçu",
  PAYMENT_CANCELLED: "Paiement annulé",
  REMINDER_SENT: "Relance envoyée",
  COLLECTION_PAUSED: "Recouvrement suspendu",
  COLLECTION_RESUMED: "Recouvrement repris",
  DISPUTED: "En litige",
  DISPUTE_RESOLVED: "Litige résolu",
  PROMISED_PAYMENT_DATE_SET: "Promesse de paiement",
};

export function statusFilterLabel(status: InvoiceStatus): string {
  return formatInvoiceStatus(status);
}

export function paymentStatusFilterLabel(status: InvoicePaymentStatus): string {
  return formatPaymentStatus(status);
}
