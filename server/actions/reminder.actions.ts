"use server";

import { revalidatePath } from "next/cache";
import type { InvoiceActivityType, ReminderActivityType, ReminderLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import {
  generateReminderHistoryCsv,
  generateRemindersCsv,
} from "@/lib/csv";
import {
  getDaysOverdue,
  getRecommendedReminderLevel,
  shouldInvoiceBeReminded,
} from "@/lib/collection-utils";
import {
  buildTemplateVariables,
  renderReminderTemplate,
} from "@/lib/reminder-templates";
import { computeReminderStats } from "@/lib/reminder-utils";
import {
  bulkSendReminderSimulationSchema,
  reminderFilterSchema,
  reminderHistoryFilterSchema,
  sendReminderSimulationSchema,
} from "@/lib/reminder-validators";
import {
  getInvoiceForReminderAction,
  getReminderByIdQuery,
  getReminderStatsQuery,
  getInvoicesForReminderExportQuery,
  getReminderHistoryForExportQuery,
  listInvoicesToRemindQuery,
  listReminderHistoryQuery,
} from "@/lib/reminders";
import { absoluteUrl } from "@/lib/email/app-url";
import { buildReminderEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { moneyToNumber, toDbDecimal } from "@/lib/money";

async function createReminderActivity(
  organizationId: string,
  reminderId: string,
  type: ReminderActivityType,
  title: string,
  description?: string | null,
  userId?: string | null,
) {
  await prisma.reminderActivity.create({
    data: {
      organizationId,
      reminderId,
      userId: userId ?? null,
      type,
      title,
      description: description ?? null,
    },
  });
}

async function createInvoiceReminderActivity(
  organizationId: string,
  invoiceId: string,
  type: InvoiceActivityType,
  title: string,
  description?: string | null,
  userId?: string | null,
) {
  await prisma.invoiceActivity.create({
    data: {
      organizationId,
      invoiceId,
      userId: userId ?? null,
      type,
      title,
      description: description ?? null,
    },
  });
}

async function processSendReminder(
  organizationId: string,
  userId: string,
  input: {
    invoiceId: string;
    recipientEmail: string;
    level: ReminderLevel;
    channel: "EMAIL" | "PHONE" | "LETTER" | "MANUAL";
    subject: string;
    message: string;
    includePaymentLinkPlaceholder?: boolean;
    internalNotes?: string | null;
  },
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, organizationId },
    include: { customer: true, organization: { select: { name: true } } },
  });
  if (!invoice) return { success: false as const, error: "Facture introuvable" };
  if (!shouldInvoiceBeReminded(invoice)) {
    return { success: false as const, error: "Cette facture n'est pas éligible à la relance" };
  }

  if (input.channel === "EMAIL") {
    const template = buildReminderEmail({
      organizationName: invoice.organization.name,
      recipientName: invoice.customer.name,
      invoiceNumber: invoice.invoiceNumber,
      subject: input.subject,
      message: input.message,
      amountDue: moneyToNumber(invoice.amountDue),
      dueDate: invoice.dueDate,
      daysOverdue: getDaysOverdue(invoice.dueDate),
      documentUrl: absoluteUrl(`/invoices/${invoice.id}/print`),
    });

    const emailResult = await sendEmail({
      to: input.recipientEmail,
      subject: input.subject,
      html: template.html,
      text: template.text,
      tags: [{ name: "type", value: "reminder" }, { name: "invoiceId", value: invoice.id }],
    });

    if (!emailResult.success) {
      return { success: false as const, error: emailResult.error };
    }
  }

  const daysOverdue = getDaysOverdue(invoice.dueDate);
  const reminderNumber = await generateNextNumber(organizationId, "REMINDER", userId);
  const now = new Date();

  const reminder = await prisma.reminder.create({
    data: {
      organizationId,
      reminderNumber,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      status: "SIMULATED_SENT",
      level: input.level,
      channel: input.channel,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      message: input.message,
      sentAt: input.channel === "EMAIL" ? now : null,
      dueDate: invoice.dueDate,
      invoiceIssueDate: invoice.issueDate,
      invoiceTotalIncludingTax: toDbDecimal(invoice.totalIncludingTax),
      invoiceAmountPaid: toDbDecimal(invoice.amountPaid),
      invoiceAmountDue: toDbDecimal(invoice.amountDue),
      daysOverdue,
      includePaymentLinkPlaceholder: input.includePaymentLinkPlaceholder ?? false,
      internalNotes: input.internalNotes ?? null,
      createdById: userId,
    },
  });

  await createReminderActivity(
    organizationId,
    reminder.id,
    "CREATED",
    "Relance créée",
    `Relance ${reminderNumber} pour ${invoice.invoiceNumber}`,
    userId,
  );

  if (input.channel === "EMAIL") {
    await createReminderActivity(
      organizationId,
      reminder.id,
      "EMAIL_SIMULATED",
      "Email envoyé",
      `Destinataire : ${input.recipientEmail}`,
      userId,
    );
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      lastReminderAt: now,
      lastReminderLevel: input.level,
      reminderCount: { increment: 1 },
      reminderStatus: "REMINDED",
    },
  });

  await createInvoiceReminderActivity(
    organizationId,
    invoice.id,
    "REMINDER_SENT",
    "Relance envoyée",
    `${reminderNumber} — ${input.subject}`,
    userId,
  );

  await prisma.customerActivity.create({
    data: {
      organizationId,
      customerId: invoice.customerId,
      type: "REMINDER_SENT",
      title: "Relance envoyée",
      description: `Facture ${invoice.invoiceNumber}`,
      activityDate: now,
    },
  });

  await createAuditLog({
    organizationId,
    userId,
    action: "REMINDER_EMAIL_SIMULATED",
    entityType: "Reminder",
    entityId: reminder.id,
    entityLabel: reminderNumber,
  });
  await createAuditLog({
    organizationId,
    userId,
    action: "INVOICE_REMINDER_SENT",
    entityType: "Invoice",
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
  });

  return { success: true as const, reminderId: reminder.id, reminderNumber };
}

function emailActionError(err: unknown): { success: false; error: string } | null {
  if (err instanceof Error && err.message.includes("envoi par email")) {
    return { success: false, error: err.message };
  }
  return null;
}

export async function listInvoicesToRemindAction(filters: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_READ");
  const parsed = reminderFilterSchema.safeParse(filters);
  const f = parsed.success ? parsed.data : reminderFilterSchema.parse({});
  return listInvoicesToRemindQuery(user.organizationId, f);
}

export async function getReminderStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_READ");
  const data = await getReminderStatsQuery(user.organizationId);
  return computeReminderStats(data.invoices, data.remindersThisMonth);
}

export async function getReminderByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_READ");
  return getReminderByIdQuery(user.organizationId, id);
}

export async function listReminderHistoryAction(filters: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_READ");
  const parsed = reminderHistoryFilterSchema.safeParse(filters);
  const f = parsed.success ? parsed.data : reminderHistoryFilterSchema.parse({});
  return listReminderHistoryQuery(user.organizationId, f);
}

export async function getInvoiceReminderPreviewAction(invoiceId: string) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_READ");
  const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
  const invoice = await getInvoiceForReminderAction(user.organizationId, invoiceId);
  if (!invoice || !org) return null;

  const level = getRecommendedReminderLevel(invoice.daysOverdue);
  const template = await prisma.reminderTemplate.findFirst({
    where: { organizationId: user.organizationId, level, isActive: true, isDefault: true },
  });

  const recipientEmail =
    invoice.customerContact?.email ?? invoice.customer.email ?? "contact@dev.local";

  const vars = buildTemplateVariables({
    customerName: invoice.customer.name,
    invoiceNumber: invoice.invoiceNumber,
    dueDate: invoice.dueDate,
    amountDue: moneyToNumber(invoice.amountDue),
    currency: invoice.currency,
    daysOverdue: invoice.daysOverdue,
    organizationName: org.name,
    includePaymentLink: true,
  });

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customer.name,
    recipientEmail,
    level,
    eligible: invoice.eligible,
    daysOverdue: invoice.daysOverdue,
    amountDue: moneyToNumber(invoice.amountDue),
    subject: template ? renderReminderTemplate(template.subject, vars) : "",
    message: template ? renderReminderTemplate(template.message, vars) : "",
    templateId: template?.id ?? null,
  };
}

export async function sendReminderEmailAction(input: unknown) {
  try {
    const user = await requireAuth();
    requirePermission(user, "REMINDERS_SEND");

    const parsed = sendReminderSimulationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
    }

    const result = await processSendReminder(user.organizationId, user.id, parsed.data);
    if (!result.success) return result;

    revalidatePath("/reminders");
    revalidatePath("/reminders/history");
    revalidatePath(`/invoices/${parsed.data.invoiceId}`);

    return {
      ...result,
      message: "Relance envoyée par email.",
    };
  } catch (err) {
    const configError = emailActionError(err);
    if (configError) return configError;
    throw err;
  }
}

/** @deprecated Utiliser sendReminderEmailAction */
export const sendReminderSimulationAction = sendReminderEmailAction;

export async function sendBulkReminderEmailAction(input: unknown) {
  try {
    const user = await requireAuth();
    requirePermission(user, "REMINDERS_SEND");

    const parsed = bulkSendReminderSimulationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
    }

    const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
    if (!org) return { success: false as const, error: "Organisation introuvable" };

    let created = 0;
    let ignored = 0;
    const errors: string[] = [];

    for (const invoiceId of parsed.data.invoiceIds) {
      const invoice = await getInvoiceForReminderAction(user.organizationId, invoiceId);
      if (!invoice || !invoice.eligible) {
        ignored++;
        continue;
      }

      const level = getRecommendedReminderLevel(invoice.daysOverdue);
      const template = await prisma.reminderTemplate.findFirst({
        where: { organizationId: user.organizationId, level, isActive: true, isDefault: true },
      });
      if (!template) {
        ignored++;
        errors.push(`${invoice.invoiceNumber} : modèle introuvable`);
        continue;
      }

      const vars = buildTemplateVariables({
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate,
        amountDue: moneyToNumber(invoice.amountDue),
        currency: invoice.currency,
        daysOverdue: invoice.daysOverdue,
        organizationName: org.name,
        includePaymentLink: true,
      });

      const result = await processSendReminder(user.organizationId, user.id, {
        invoiceId,
        recipientEmail: invoice.customerContact?.email ?? invoice.customer.email ?? "",
        level,
        channel: "EMAIL",
        subject: renderReminderTemplate(template.subject, vars),
        message: renderReminderTemplate(template.message, vars),
        includePaymentLinkPlaceholder: true,
      });

      if (result.success) created++;
      else {
        ignored++;
        if ("error" in result && result.error) errors.push(`${invoice.invoiceNumber} : ${result.error}`);
      }
    }

    if (created > 0) {
      await createAuditLog({
        organizationId: user.organizationId,
        userId: user.id,
        action: "REMINDER_BULK_EMAIL_SIMULATED",
        entityType: "Reminder",
        entityLabel: `${created} relances envoyées`,
      });
    }

    revalidatePath("/reminders");
    revalidatePath("/reminders/history");

    return {
      success: true as const,
      created,
      ignored,
      errors,
      message: `${created} relance(s) envoyée(s), ${ignored} facture(s) ignorée(s).`,
    };
  } catch (err) {
    const configError = emailActionError(err);
    if (configError) return configError;
    throw err;
  }
}

/** @deprecated Utiliser sendBulkReminderEmailAction */
export const sendBulkReminderSimulationAction = sendBulkReminderEmailAction;

export async function cancelReminderAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_CANCEL");

  const reminder = await prisma.reminder.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!reminder) return { success: false as const, error: "Relance introuvable" };
  if (reminder.status !== "DRAFT") {
    return { success: false as const, error: "Seules les relances brouillon peuvent être annulées" };
  }

  await prisma.reminder.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await createReminderActivity(
    user.organizationId,
    id,
    "CANCELLED",
    "Relance annulée",
    null,
    user.id,
  );
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_CANCELLED",
    entityType: "Reminder",
    entityId: id,
    entityLabel: reminder.reminderNumber,
  });

  revalidatePath("/reminders/history");
  return { success: true as const };
}

export async function exportRemindersCsvAction(filters: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_EXPORT");

  const parsed = reminderFilterSchema.safeParse(filters);
  const f = parsed.success ? parsed.data : {};
  const invoices = await getInvoicesForReminderExportQuery(user.organizationId, f);
  const csv = generateRemindersCsv(invoices);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_EXPORTED",
    entityType: "Reminder",
    entityLabel: `Export ${invoices.length} factures`,
  });

  return { success: true as const, csv, filename: "relances.csv" };
}

export async function exportReminderHistoryCsvAction() {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_EXPORT");

  const reminders = await getReminderHistoryForExportQuery(user.organizationId, {});
  const csv = generateReminderHistoryCsv(reminders);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_HISTORY_EXPORTED",
    entityType: "Reminder",
    entityLabel: `Export historique ${reminders.length} relances`,
  });

  return { success: true as const, csv, filename: "historique-relances.csv" };
}

export async function getCustomersForReminderFilterAction() {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_READ");
  return prisma.customer.findMany({
    where: { organizationId: user.organizationId, isArchived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
