"use server";

import { revalidatePath } from "next/cache";
import type { InvoiceActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { shouldInvoiceBeReminded } from "@/lib/collection-utils";
import {
  createReminderNoteSchema,
  markInvoiceDisputedSchema,
  pauseCollectionSchema,
  setPromisedPaymentDateSchema,
} from "@/lib/reminder-validators";

async function createInvoiceCollectionActivity(
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

export async function pauseCollectionAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_UPDATE");

  const parsed = pauseCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: parsed.data.invoiceId, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false as const, error: "Facture introuvable" };

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      isCollectionPaused: true,
      collectionPausedReason: parsed.data.reason,
      reminderStatus: "PAUSED",
    },
  });

  await prisma.reminderNote.create({
    data: {
      organizationId: user.organizationId,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      userId: user.id,
      type: "INTERNAL",
      content: `Recouvrement suspendu : ${parsed.data.reason}`,
    },
  });

  await createInvoiceCollectionActivity(
    user.organizationId,
    invoice.id,
    "COLLECTION_PAUSED",
    "Recouvrement suspendu",
    parsed.data.reason,
    user.id,
  );
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "COLLECTION_PAUSED",
    entityType: "Invoice",
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/reminders");
  revalidatePath(`/invoices/${invoice.id}`);
  return { success: true as const };
}

export async function resumeCollectionAction(invoiceId: string) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_UPDATE");

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false as const, error: "Facture introuvable" };

  const reminderStatus = shouldInvoiceBeReminded(invoice) ? "TO_REMIND" : "NONE";

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      isCollectionPaused: false,
      collectionPausedReason: null,
      reminderStatus,
    },
  });

  await createInvoiceCollectionActivity(
    user.organizationId,
    invoice.id,
    "COLLECTION_RESUMED",
    "Recouvrement repris",
    null,
    user.id,
  );
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "COLLECTION_RESUMED",
    entityType: "Invoice",
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/reminders");
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true as const };
}

export async function markInvoiceDisputedAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_UPDATE");

  const parsed = markInvoiceDisputedSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: parsed.data.invoiceId, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false as const, error: "Facture introuvable" };

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      isDisputed: true,
      disputeReason: parsed.data.reason,
      reminderStatus: "DISPUTED",
    },
  });

  await prisma.reminderNote.create({
    data: {
      organizationId: user.organizationId,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      userId: user.id,
      type: "DISPUTE",
      content: parsed.data.reason,
    },
  });

  await createInvoiceCollectionActivity(
    user.organizationId,
    invoice.id,
    "DISPUTED",
    "Facture en litige",
    parsed.data.reason,
    user.id,
  );
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_DISPUTED",
    entityType: "Invoice",
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/reminders");
  revalidatePath(`/invoices/${invoice.id}`);
  return { success: true as const };
}

export async function resolveInvoiceDisputeAction(invoiceId: string) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_UPDATE");

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false as const, error: "Facture introuvable" };

  const reminderStatus = shouldInvoiceBeReminded(invoice) ? "TO_REMIND" : "NONE";

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      isDisputed: false,
      disputeReason: null,
      reminderStatus,
    },
  });

  await createInvoiceCollectionActivity(
    user.organizationId,
    invoice.id,
    "DISPUTE_RESOLVED",
    "Litige résolu",
    null,
    user.id,
  );
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_DISPUTE_RESOLVED",
    entityType: "Invoice",
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/reminders");
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true as const };
}

export async function setPromisedPaymentDateAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_UPDATE");

  const parsed = setPromisedPaymentDateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: parsed.data.invoiceId, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false as const, error: "Facture introuvable" };

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { promisedPaymentDate: parsed.data.promisedPaymentDate },
  });

  if (parsed.data.note) {
    await prisma.reminderNote.create({
      data: {
        organizationId: user.organizationId,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        userId: user.id,
        type: "PROMISE_TO_PAY",
        content: parsed.data.note,
      },
    });
  }

  await createInvoiceCollectionActivity(
    user.organizationId,
    invoice.id,
    "PROMISED_PAYMENT_DATE_SET",
    "Promesse de paiement enregistrée",
    parsed.data.promisedPaymentDate.toISOString().slice(0, 10),
    user.id,
  );
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROMISED_PAYMENT_DATE_SET",
    entityType: "Invoice",
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/reminders");
  revalidatePath(`/invoices/${invoice.id}`);
  return { success: true as const };
}

export async function createReminderNoteAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "REMINDERS_CREATE");

  const parsed = createReminderNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const note = await prisma.reminderNote.create({
    data: {
      organizationId: user.organizationId,
      customerId: parsed.data.customerId,
      invoiceId: parsed.data.invoiceId ?? null,
      reminderId: parsed.data.reminderId ?? null,
      userId: user.id,
      type: parsed.data.type,
      content: parsed.data.content,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_NOTE_CREATED",
    entityType: "ReminderNote",
    entityId: note.id,
    entityLabel: parsed.data.type,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_COLLECTION_NOTE_CREATED",
    entityType: "Customer",
    entityId: parsed.data.customerId,
  });

  revalidatePath("/reminders");
  if (parsed.data.invoiceId) revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  revalidatePath(`/customers/${parsed.data.customerId}`);

  return { success: true as const, noteId: note.id };
}
