import type { InvoiceReminderStatus, ReminderLevel, ReminderStatus } from "@prisma/client";
import { getDaysOverdue, getRecommendedReminderLevel } from "@/lib/collection-utils";
import { money, moneyAdd, moneyDiv, moneyToNumber, type MoneyInput } from "@/lib/money";

export const REMINDER_LEVEL_LABELS: Record<ReminderLevel, string> = {
  FRIENDLY: "Relance amiable",
  FIRST_NOTICE: "Première relance",
  SECOND_NOTICE: "Deuxième relance",
  FINAL_NOTICE: "Dernière relance",
};

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  DRAFT: "Brouillon",
  SIMULATED_SENT: "Envoyée",
  CANCELLED: "Annulée",
};

export const INVOICE_REMINDER_STATUS_LABELS: Record<InvoiceReminderStatus, string> = {
  NONE: "Aucune",
  TO_REMIND: "À relancer",
  REMINDED: "Relancée",
  PAUSED: "Suspendue",
  DISPUTED: "En litige",
};

export function getReminderSentDate(reminder: {
  sentAt: Date | null;
  simulatedSentAt: Date | null;
}): Date | null {
  return reminder.sentAt ?? reminder.simulatedSentAt;
}

export const REMINDER_NOTE_TYPE_LABELS: Record<string, string> = {
  GENERAL: "Générale",
  CALL: "Appel",
  EMAIL: "Email",
  DISPUTE: "Litige",
  PROMISE_TO_PAY: "Promesse de paiement",
  INTERNAL: "Interne",
};

export const REMINDER_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CREATED: "Relance créée",
  UPDATED: "Relance modifiée",
  EMAIL_SIMULATED: "Email envoyé",
  CANCELLED: "Relance annulée",
  NOTE: "Note ajoutée",
  TEMPLATE_APPLIED: "Modèle appliqué",
  PAYMENT_LINK_PLACEHOLDER_ADDED: "Lien paiement ajouté",
};

export function getReminderLevelLabel(level: ReminderLevel): string {
  return REMINDER_LEVEL_LABELS[level] ?? level;
}

export function getReminderLevelColor(level: ReminderLevel): string {
  switch (level) {
    case "FRIENDLY":
      return "bg-blue-100 text-blue-800";
    case "FIRST_NOTICE":
      return "bg-amber-100 text-amber-800";
    case "SECOND_NOTICE":
      return "bg-orange-100 text-orange-800";
    case "FINAL_NOTICE":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export type InvoiceReminderRow = {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  currency: string;
  paymentStatus: string;
  status: string;
  reminderStatus: InvoiceReminderStatus;
  lastReminderAt: Date | null;
  lastReminderLevel: ReminderLevel | null;
  reminderCount: number;
  isCollectionPaused: boolean;
  isDisputed: boolean;
  promisedPaymentDate: Date | null;
  customer: { id: string; name: string; email: string | null };
};

export function enrichInvoiceForReminder<T extends InvoiceReminderRow>(
  invoice: T,
  now: Date = new Date(),
): T & { daysOverdue: number; recommendedLevel: ReminderLevel } {
  const daysOverdue = getDaysOverdue(invoice.dueDate, now);
  return {
    ...invoice,
    daysOverdue,
    recommendedLevel: getRecommendedReminderLevel(daysOverdue),
  };
}

export function computeReminderStats(
  invoices: (InvoiceReminderRow & { daysOverdue: number })[],
  remindersThisMonth: number,
) {
  const toRemind = invoices.filter((i) => !i.isCollectionPaused && !i.isDisputed);
  const totalOverdue = moneyToNumber(
    toRemind.reduce((s, i) => moneyAdd(s, i.amountDue), money(0)),
  );
  const bucket1_7 = toRemind.filter((i) => i.daysOverdue >= 1 && i.daysOverdue <= 7).length;
  const bucket8_30 = toRemind.filter((i) => i.daysOverdue >= 8 && i.daysOverdue <= 30).length;
  const bucket30plus = toRemind.filter((i) => i.daysOverdue > 30).length;
  const disputed = invoices.filter((i) => i.isDisputed).length;
  const paused = invoices.filter((i) => i.isCollectionPaused).length;
  const promised = invoices.filter((i) => i.promisedPaymentDate).length;
  const avgOverdue =
    toRemind.length > 0 ? moneyToNumber(moneyDiv(totalOverdue, toRemind.length)) : 0;

  const byCustomer = new Map<string, { name: string; amount: number }>();
  for (const inv of toRemind) {
    const existing = byCustomer.get(inv.customer.id) ?? {
      name: inv.customer.name,
      amount: 0,
    };
    existing.amount = moneyToNumber(moneyAdd(existing.amount, inv.amountDue));
    byCustomer.set(inv.customer.id, existing);
  }
  const topCustomers = [...byCustomer.entries()]
    .map(([id, v]) => ({ id, name: v.name, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    toRemindCount: toRemind.length,
    totalOverdue,
    bucket1_7,
    bucket8_30,
    bucket30plus,
    remindersThisMonth,
    disputed,
    paused,
    promised,
    avgOverdue,
    topCustomers,
  };
}
