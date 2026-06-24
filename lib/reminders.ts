import type { Prisma } from "@prisma/client";
import type { ReminderFilterInput, ReminderHistoryFilterInput } from "@/lib/reminder-validators";
import { moneyAdd, moneySub, moneyToNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getDaysOverdue, shouldInvoiceBeReminded } from "@/lib/collection-utils";
import { enrichInvoiceForReminder } from "@/lib/reminder-utils";

function reminderSentDateFilter(
  dateFrom?: string,
  dateTo?: string,
): Prisma.ReminderWhereInput | Record<string, never> {
  if (!dateFrom && !dateTo) return {};
  const range = {
    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
    ...(dateTo ? { lte: new Date(dateTo) } : {}),
  };
  return {
    OR: [{ sentAt: range }, { AND: [{ sentAt: null }, { simulatedSentAt: range }] }],
  };
}

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  issueDate: true,
  dueDate: true,
  totalIncludingTax: true,
  amountPaid: true,
  amountDue: true,
  currency: true,
  paymentStatus: true,
  status: true,
  reminderStatus: true,
  lastReminderAt: true,
  lastReminderLevel: true,
  reminderCount: true,
  isCollectionPaused: true,
  isDisputed: true,
  promisedPaymentDate: true,
  customer: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InvoiceSelect;

function baseInvoiceWhere(organizationId: string): Prisma.InvoiceWhereInput {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return {
    organizationId,
    isArchived: false,
    status: { in: ["VALIDATED", "SENT", "OVERDUE", "PARTIALLY_PAID"] },
    paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
    amountDue: { gt: 0 },
    dueDate: { lt: today },
  };
}

export function buildInvoicesToRemindWhere(
  organizationId: string,
  filters: Partial<ReminderFilterInput>,
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {
    ...baseInvoiceWhere(organizationId),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(filters.amountMin !== undefined || filters.amountMax !== undefined
      ? {
          amountDue: {
            gt: 0,
            ...(filters.amountMin !== undefined ? { gte: filters.amountMin } : {}),
            ...(filters.amountMax !== undefined ? { lte: filters.amountMax } : {}),
          },
        }
      : {}),
    ...(filters.noReminder === "true" ? { reminderCount: 0 } : {}),
    ...(filters.reminded === "true" ? { reminderCount: { gt: 0 } } : {}),
    ...(filters.disputed === "true" ? { isDisputed: true } : {}),
    ...(filters.paused === "true" ? { isCollectionPaused: true } : {}),
    ...(filters.promised === "true" ? { promisedPaymentDate: { not: null } } : {}),
    ...(filters.q
      ? {
          OR: [
            { invoiceNumber: { contains: filters.q } },
            { internalNotes: { contains: filters.q } },
            { disputeReason: { contains: filters.q } },
            { customer: { name: { contains: filters.q } } },
            { customer: { email: { contains: filters.q } } },
          ],
        }
      : {}),
  };

  return where;
}

export async function listInvoicesToRemindQuery(
  organizationId: string,
  filters: Partial<ReminderFilterInput>,
) {
  const where = buildInvoicesToRemindWhere(organizationId, filters);
  const invoices = await prisma.invoice.findMany({
    where,
    select: invoiceSelect,
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();
  let enriched = invoices.map((inv) => enrichInvoiceForReminder(inv, now));

  const showDisputed = filters.disputed === "true" || filters.quickFilter === "disputed";
  const showPaused = filters.paused === "true" || filters.quickFilter === "paused";
  if (!showDisputed && !showPaused) {
    enriched = enriched.filter((i) => !i.isDisputed && !i.isCollectionPaused);
  }
  if (filters.disputed === "false") enriched = enriched.filter((i) => !i.isDisputed);
  if (filters.paused === "false") enriched = enriched.filter((i) => !i.isCollectionPaused);

  if (filters.level) {
    enriched = enriched.filter((i) => i.recommendedLevel === filters.level);
  }
  if (filters.daysOverdueMin !== undefined) {
    enriched = enriched.filter((i) => i.daysOverdue >= filters.daysOverdueMin!);
  }
  if (filters.daysOverdueMax !== undefined) {
    enriched = enriched.filter((i) => i.daysOverdue <= filters.daysOverdueMax!);
  }
  if (filters.quickFilter) {
    switch (filters.quickFilter) {
      case "1-7":
        enriched = enriched.filter((i) => i.daysOverdue >= 1 && i.daysOverdue <= 7);
        break;
      case "8-30":
        enriched = enriched.filter((i) => i.daysOverdue >= 8 && i.daysOverdue <= 30);
        break;
      case "31-60":
        enriched = enriched.filter((i) => i.daysOverdue >= 31 && i.daysOverdue <= 60);
        break;
      case "60+":
        enriched = enriched.filter((i) => i.daysOverdue > 60);
        break;
      case "no-reminder":
        enriched = enriched.filter((i) => i.reminderCount === 0);
        break;
      case "disputed":
        enriched = enriched.filter((i) => i.isDisputed);
        break;
      case "paused":
        enriched = enriched.filter((i) => i.isCollectionPaused);
        break;
      case "promised":
        enriched = enriched.filter((i) => i.promisedPaymentDate);
        break;
    }
  }

  const sortBy = filters.sortBy ?? "daysOverdue";
  const order = filters.sortOrder ?? "desc";
  enriched.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "amountDue":
        cmp = moneyToNumber(moneySub(a.amountDue, b.amountDue));
        break;
      case "dueDate":
        cmp = a.dueDate.getTime() - b.dueDate.getTime();
        break;
      case "customer":
        cmp = a.customer.name.localeCompare(b.customer.name);
        break;
      case "reminderCount":
        cmp = a.reminderCount - b.reminderCount;
        break;
      case "lastReminderAt":
        cmp = (a.lastReminderAt?.getTime() ?? 0) - (b.lastReminderAt?.getTime() ?? 0);
        break;
      default:
        cmp = a.daysOverdue - b.daysOverdue;
    }
    return order === "asc" ? cmp : -cmp;
  });

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const total = enriched.length;
  const paged = enriched.slice((page - 1) * pageSize, page * pageSize);

  return { invoices: paged, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type ReminderGridRow = {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  companyName: string;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  totalIncludingTax: number;
  amountPaid: number;
  amountDue: number;
  reminderLevel: string;
  lastReminderAt: string | null;
  reminderCount: number;
  reminderStatus: string;
  currency: string;
};

export async function listRemindersForGridQuery(
  organizationId: string,
  filters: Partial<ReminderFilterInput> & {
    issueDateFrom?: string;
    issueDateTo?: string;
    daysOverdueMin?: number;
  },
) {
  const where = buildInvoicesToRemindWhere(organizationId, filters);
  if (filters.issueDateFrom || filters.issueDateTo) {
    where.issueDate = {
      ...(filters.issueDateFrom ? { gte: new Date(filters.issueDateFrom) } : {}),
      ...(filters.issueDateTo ? { lte: new Date(filters.issueDateTo) } : {}),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      ...invoiceSelect,
      customer: { select: { id: true, name: true, email: true, legalName: true, displayName: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 5000,
  });

  const now = new Date();
  let rows: ReminderGridRow[] = invoices.map((inv) => {
    const enriched = enrichInvoiceForReminder(inv, now);
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customer.id,
      customerName: inv.customer.name,
      companyName: inv.customer.legalName ?? inv.customer.displayName ?? "",
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      daysOverdue: enriched.daysOverdue,
      totalIncludingTax: moneyToNumber(inv.totalIncludingTax),
      amountPaid: moneyToNumber(inv.amountPaid),
      amountDue: moneyToNumber(inv.amountDue),
      reminderLevel: inv.lastReminderLevel ?? enriched.recommendedLevel,
      lastReminderAt: inv.lastReminderAt ? inv.lastReminderAt.toISOString() : null,
      reminderCount: inv.reminderCount,
      reminderStatus: inv.reminderStatus,
      currency: inv.currency,
    };
  });

  if (filters.daysOverdueMin !== undefined) {
    rows = rows.filter((r) => r.daysOverdue >= filters.daysOverdueMin!);
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));
  const total = rows.length;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    rows: paged,
    allRows: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function buildRemindersGridCsv(rows: ReminderGridRow[]): string {
  const header = [
    "Client",
    "Société",
    "Facture",
    "Date facture",
    "Date échéance",
    "Jours de retard",
    "Total TTC",
    "Déjà payé",
    "Solde dû",
    "Niveau relance",
    "Dernière relance",
    "Statut",
  ].join(";");
  const lines = rows.map((r) =>
    [
      r.customerName,
      r.companyName,
      r.invoiceNumber,
      new Date(r.issueDate).toLocaleDateString("fr-FR"),
      new Date(r.dueDate).toLocaleDateString("fr-FR"),
      r.daysOverdue,
      r.totalIncludingTax.toFixed(2),
      r.amountPaid.toFixed(2),
      r.amountDue.toFixed(2),
      r.reminderLevel,
      r.lastReminderAt ? new Date(r.lastReminderAt).toLocaleDateString("fr-FR") : "",
      r.reminderStatus,
    ].join(";"),
  );
  return [header, ...lines].join("\n");
}

export async function getAllInvoicesToRemindForStats(organizationId: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      ...baseInvoiceWhere(organizationId),
      isDisputed: false,
      isCollectionPaused: false,
    },
    select: invoiceSelect,
  });
  return invoices.map((inv) => enrichInvoiceForReminder(inv));
}

export async function getReminderStatsQuery(organizationId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [invoices, remindersThisMonth] = await Promise.all([
    getAllInvoicesToRemindForStats(organizationId),
    prisma.reminder.count({
      where: {
        organizationId,
        status: "SIMULATED_SENT",
        OR: [
          { sentAt: { gte: monthStart } },
          { AND: [{ sentAt: null }, { simulatedSentAt: { gte: monthStart } }] },
        ],
      },
    }),
  ]);

  return { invoices, remindersThisMonth };
}

export async function getReminderByIdQuery(organizationId: string, id: string) {
  return prisma.reminder.findFirst({
    where: { id, organizationId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      invoice: { select: { id: true, invoiceNumber: true, currency: true } },
      createdBy: { select: { id: true, name: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listReminderHistoryQuery(
  organizationId: string,
  filters: Partial<ReminderHistoryFilterInput>,
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const where: Prisma.ReminderWhereInput = {
    organizationId,
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.invoiceId ? { invoiceId: filters.invoiceId } : {}),
    ...(filters.level ? { level: filters.level } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo ? reminderSentDateFilter(filters.dateFrom, filters.dateTo) : {}),
    ...(filters.amountMin !== undefined || filters.amountMax !== undefined
      ? {
          invoiceAmountDue: {
            ...(filters.amountMin !== undefined ? { gte: filters.amountMin } : {}),
            ...(filters.amountMax !== undefined ? { lte: filters.amountMax } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { reminderNumber: { contains: filters.q } },
            { subject: { contains: filters.q } },
            { recipientEmail: { contains: filters.q } },
            { customer: { name: { contains: filters.q } } },
            { invoice: { invoiceNumber: { contains: filters.q } } },
          ],
        }
      : {}),
  };

  const [reminders, total] = await Promise.all([
    prisma.reminder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: [{ sentAt: "desc" }, { simulatedSentAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reminder.count({ where }),
  ]);

  return { reminders, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getRemindersByInvoiceQuery(organizationId: string, invoiceId: string) {
  return prisma.reminder.findMany({
    where: { organizationId, invoiceId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
}

export async function getReminderNotesByInvoiceQuery(organizationId: string, invoiceId: string) {
  return prisma.reminderNote.findMany({
    where: { organizationId, invoiceId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
}

export async function getCustomerCollectionDataQuery(organizationId: string, customerId: string) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const [overdueInvoices, reminders, notes] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        organizationId,
        customerId,
        isArchived: false,
        amountDue: { gt: 0 },
        dueDate: { lt: today },
        status: { notIn: ["DRAFT", "PAID", "CANCELLED", "CREDITED"] },
      },
      select: invoiceSelect,
      orderBy: { dueDate: "asc" },
    }),
    prisma.reminder.findMany({
      where: { organizationId, customerId, status: "SIMULATED_SENT" },
      orderBy: [{ sentAt: "desc" }, { simulatedSentAt: "desc" }],
      take: 10,
    }),
    prisma.reminderNote.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return {
    overdueInvoices: overdueInvoices.map((i) => enrichInvoiceForReminder(i)),
    reminders,
    notes,
    totalOverdue: moneyToNumber(
      overdueInvoices.reduce((s, i) => moneyAdd(s, i.amountDue), moneyAdd(0, 0)),
    ),
  };
}

export async function getInvoicesForReminderExportQuery(
  organizationId: string,
  filters: Partial<ReminderFilterInput>,
) {
  const { invoices } = await listInvoicesToRemindQuery(organizationId, {
    ...filters,
    page: 1,
    pageSize: 10000,
  });
  return invoices;
}

export async function getReminderHistoryForExportQuery(
  organizationId: string,
  filters: Partial<ReminderHistoryFilterInput>,
) {
  return prisma.reminder.findMany({
    where: { organizationId },
    include: {
      customer: { select: { name: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: [{ sentAt: "desc" }, { simulatedSentAt: "desc" }],
  });
}

export async function getInvoiceForReminderAction(organizationId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      customerContact: { select: { email: true } },
    },
  });
  if (!invoice) return null;
  const daysOverdue = getDaysOverdue(invoice.dueDate);
  const eligible = shouldInvoiceBeReminded(invoice);
  return { ...invoice, daysOverdue, eligible };
}
