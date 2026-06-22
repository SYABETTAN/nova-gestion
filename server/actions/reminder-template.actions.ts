"use server";

import { revalidatePath } from "next/cache";
import { APP_DISPLAY_NAME } from "@/lib/branding";
import { resolveOrganizationDisplayName } from "@/lib/organization-display";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  buildTemplateVariables,
  DEFAULT_REMINDER_TEMPLATES,
  renderReminderTemplate,
} from "@/lib/reminder-templates";
import {
  createReminderTemplateSchema,
  updateReminderTemplateSchema,
} from "@/lib/reminder-validators";

export async function listReminderTemplatesAction() {
  const user = await requireAuth();
  requirePermission(user, "REMINDER_TEMPLATES_READ");
  return prisma.reminderTemplate.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });
}

export async function createReminderTemplateAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "REMINDER_TEMPLATES_UPDATE");

  const parsed = createReminderTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  if (parsed.data.isDefault) {
    await prisma.reminderTemplate.updateMany({
      where: { organizationId: user.organizationId, level: parsed.data.level },
      data: { isDefault: false },
    });
  }

  const template = await prisma.reminderTemplate.create({
    data: { organizationId: user.organizationId, ...parsed.data },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_TEMPLATE_CREATED",
    entityType: "ReminderTemplate",
    entityId: template.id,
    entityLabel: template.name,
  });

  revalidatePath("/reminders/templates");
  return { success: true as const, templateId: template.id };
}

export async function updateReminderTemplateAction(id: string, input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "REMINDER_TEMPLATES_UPDATE");

  const parsed = updateReminderTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const existing = await prisma.reminderTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return { success: false as const, error: "Modèle introuvable" };

  if (parsed.data.isDefault && parsed.data.level) {
    await prisma.reminderTemplate.updateMany({
      where: { organizationId: user.organizationId, level: parsed.data.level },
      data: { isDefault: false },
    });
  }

  await prisma.reminderTemplate.update({ where: { id }, data: parsed.data });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_TEMPLATE_UPDATED",
    entityType: "ReminderTemplate",
    entityId: id,
    entityLabel: existing.name,
  });

  revalidatePath("/reminders/templates");
  return { success: true as const };
}

export async function disableReminderTemplateAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "REMINDER_TEMPLATES_UPDATE");

  const existing = await prisma.reminderTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return { success: false as const, error: "Modèle introuvable" };

  await prisma.reminderTemplate.update({
    where: { id },
    data: { isActive: false, isDefault: false },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_TEMPLATE_DISABLED",
    entityType: "ReminderTemplate",
    entityId: id,
    entityLabel: existing.name,
  });

  revalidatePath("/reminders/templates");
  return { success: true as const };
}

export async function previewReminderTemplateAction(templateId: string, invoiceId?: string) {
  const user = await requireAuth();
  requirePermission(user, "REMINDER_TEMPLATES_READ");

  const template = await prisma.reminderTemplate.findFirst({
    where: { id: templateId, organizationId: user.organizationId },
  });
  if (!template) return null;

  const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
  const invoice = invoiceId
    ? await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId: user.organizationId },
        include: { customer: true },
      })
    : null;

  const vars = buildTemplateVariables({
    customerName: invoice?.customer.name ?? "Client Demo",
    invoiceNumber: invoice?.invoiceNumber ?? "FAC-2026-0001",
    dueDate: invoice?.dueDate ?? new Date(),
    amountDue: invoice?.amountDue ?? 1250,
    currency: invoice?.currency ?? "EUR",
    daysOverdue: 15,
    organizationName: org
      ? resolveOrganizationDisplayName(org.name, org.slug)
      : APP_DISPLAY_NAME,
    includePaymentLink: true,
  });

  return {
    subject: renderReminderTemplate(template.subject, vars),
    message: renderReminderTemplate(template.message, vars),
  };
}

export async function seedDefaultTemplatesIfMissing(organizationId: string) {
  const count = await prisma.reminderTemplate.count({ where: { organizationId } });
  if (count > 0) return;

  for (const t of DEFAULT_REMINDER_TEMPLATES) {
    await prisma.reminderTemplate.create({
      data: {
        organizationId,
        name: t.name,
        level: t.level,
        subject: t.subject,
        message: t.message,
        isDefault: true,
        isActive: true,
      },
    });
  }
}
