"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  canAcceptQuote,
  canCancelQuote,
  canConvertQuote,
  canExpireQuote,
  canMarkViewed,
  canRefuseQuote,
} from "@/lib/quote-status";
import type { QuoteActivityType } from "@prisma/client";
import { sendQuoteSimulationSchema } from "@/lib/quote-validators";
import { absoluteUrl } from "@/lib/email/app-url";
import { buildQuoteEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { getDocumentDownloadPath } from "@/lib/documents/document-storage";
import { storeQuotePdf } from "@/lib/documents/pdf-service";
import { getStorageProvider } from "@/lib/storage";

async function createQuoteActivity(
  organizationId: string,
  quoteId: string,
  type: QuoteActivityType,
  title: string,
  description?: string | null,
  userId?: string | null,
) {
  await prisma.quoteActivity.create({
    data: {
      organizationId,
      quoteId,
      userId: userId ?? null,
      type,
      title,
      description: description ?? null,
    },
  });
}

async function getQuoteOrFail(organizationId: string, id: string) {
  return prisma.quote.findFirst({
    where: { id, organizationId },
    include: {
      lines: true,
      customer: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });
}

function emailActionError(err: unknown): { success: false; error: string } | null {
  if (err instanceof Error && err.message.includes("envoi par email")) {
    return { success: false, error: err.message };
  }
  return null;
}

export async function sendQuoteEmailAction(id: string, formData: FormData) {
  try {
    const user = await requireAuth();
    requirePermission(user, "QUOTES_UPDATE");

    const quote = await getQuoteOrFail(user.organizationId, id);
    if (!quote) return { success: false, error: "Devis introuvable" };

    const parsed = sendQuoteSimulationSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
    }

    const data = parsed.data;

    let pdfBuffer: Buffer | null = null;
    let pdfFileName = `devis-${quote.quoteNumber}.pdf`;
    let pdfDocumentId: string | null = null;
    try {
      const { document } = await storeQuotePdf({
        quote,
        organizationId: user.organizationId,
        userId: user.id,
      });
      pdfFileName = document.fileName;
      pdfDocumentId = document.id;
      pdfBuffer = await getStorageProvider().get(document.storageKey);
    } catch (pdfErr) {
      console.error("[quote-email] PDF generation failed", pdfErr);
    }

    const template = buildQuoteEmail({
      organizationName: quote.organization.name,
      recipientName: quote.customer.name,
      quoteNumber: quote.quoteNumber,
      quoteTitle: quote.title,
      totalIncludingTax: quote.totalIncludingTax,
      validUntil: quote.validUntil,
      customMessage: data.message,
      documentUrl: pdfDocumentId
        ? absoluteUrl(getDocumentDownloadPath(pdfDocumentId))
        : absoluteUrl(`/quotes/${id}/print`),
    });

    const emailResult = await sendEmail({
      to: data.recipient,
      subject: data.subject || template.subject,
      html: template.html,
      text: template.text,
      tags: [{ name: "type", value: "quote" }, { name: "quoteId", value: id }],
      attachments: pdfBuffer
        ? [{ filename: pdfFileName, content: pdfBuffer }]
        : undefined,
    });

    if (!emailResult.success) {
      return { success: false, error: emailResult.error };
    }

    const updates: { status?: "SENT"; sentAt?: Date } = {};
    if (quote.status === "DRAFT") {
      updates.status = "SENT";
      updates.sentAt = new Date();
    }

    if (Object.keys(updates).length > 0) {
      await prisma.quote.update({ where: { id }, data: updates });
    }

    await createQuoteActivity(
      user.organizationId,
      id,
      "EMAIL_SIMULATED",
      "Email envoyé",
      `Destinataire : ${data.recipient} — Objet : ${data.subject || template.subject}`,
      user.id,
    );

    if (quote.status === "DRAFT") {
      await createQuoteActivity(
        user.organizationId,
        id,
        "SENT",
        "Devis envoyé",
        null,
        user.id,
      );
    }

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "QUOTE_EMAIL_SIMULATED",
      entityType: "Quote",
      entityId: id,
      entityLabel: quote.quoteNumber,
      newValues: {
        recipient: data.recipient,
        subject: data.subject || template.subject,
        messageId: emailResult.messageId,
        provider: emailResult.provider,
      },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    return { success: true, message: "Devis envoyé par email." };
  } catch (err) {
    const configError = emailActionError(err);
    if (configError) return configError;
    throw err;
  }
}

/** @deprecated Utiliser sendQuoteEmailAction */
export const sendQuoteSimulationAction = sendQuoteEmailAction;

export async function markQuoteViewedAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_VALIDATE");

  const quote = await getQuoteOrFail(user.organizationId, id);
  if (!quote) return { success: false, error: "Devis introuvable" };
  if (!canMarkViewed(quote.status)) {
    return { success: false, error: "Action non autorisée pour ce statut" };
  }

  await prisma.quote.update({ where: { id }, data: { status: "VIEWED" } });
  await createQuoteActivity(user.organizationId, id, "VIEWED", "Devis consulté", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_VIEWED",
    entityType: "Quote",
    entityId: id,
    entityLabel: quote.quoteNumber,
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function acceptQuoteAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_VALIDATE");

  const quote = await getQuoteOrFail(user.organizationId, id);
  if (!quote) return { success: false, error: "Devis introuvable" };
  if (!canAcceptQuote(quote.status)) {
    return { success: false, error: "Seuls les devis envoyés ou consultés peuvent être acceptés" };
  }

  await prisma.quote.update({
    where: { id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  await createQuoteActivity(user.organizationId, id, "ACCEPTED", "Devis accepté", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_ACCEPTED",
    entityType: "Quote",
    entityId: id,
    entityLabel: quote.quoteNumber,
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function refuseQuoteAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_VALIDATE");

  const quote = await getQuoteOrFail(user.organizationId, id);
  if (!quote) return { success: false, error: "Devis introuvable" };
  if (!canRefuseQuote(quote.status)) {
    return { success: false, error: "Seuls les devis envoyés ou consultés peuvent être refusés" };
  }

  await prisma.quote.update({
    where: { id },
    data: { status: "REFUSED", refusedAt: new Date() },
  });

  await createQuoteActivity(user.organizationId, id, "REFUSED", "Devis refusé", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_REFUSED",
    entityType: "Quote",
    entityId: id,
    entityLabel: quote.quoteNumber,
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function expireQuoteAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_VALIDATE");

  const quote = await getQuoteOrFail(user.organizationId, id);
  if (!quote) return { success: false, error: "Devis introuvable" };
  if (!canExpireQuote(quote.status)) {
    return { success: false, error: "Action non autorisée pour ce statut" };
  }

  await prisma.quote.update({
    where: { id },
    data: { status: "EXPIRED", expiredAt: new Date() },
  });

  await createQuoteActivity(user.organizationId, id, "EXPIRED", "Devis expiré", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_EXPIRED",
    entityType: "Quote",
    entityId: id,
    entityLabel: quote.quoteNumber,
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function cancelQuoteAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_VALIDATE");

  const quote = await getQuoteOrFail(user.organizationId, id);
  if (!quote) return { success: false, error: "Devis introuvable" };
  if (!canCancelQuote(quote.status)) {
    return { success: false, error: "Ce devis ne peut pas être annulé" };
  }

  await prisma.quote.update({ where: { id }, data: { status: "CANCELLED" } });
  await createQuoteActivity(user.organizationId, id, "CANCELLED", "Devis annulé", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_CANCELLED",
    entityType: "Quote",
    entityId: id,
    entityLabel: quote.quoteNumber,
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

export async function convertQuoteToInvoiceAction(id: string) {
  const { createInvoiceFromQuoteAction } = await import("@/server/actions/invoice.actions");
  return createInvoiceFromQuoteAction(id);
}

/** @deprecated Utiliser convertQuoteToInvoiceAction */
export const convertQuoteToInvoicePlaceholderAction = convertQuoteToInvoiceAction;

export async function generateQuotePrintAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_READ");

  const quote = await getQuoteOrFail(user.organizationId, id);
  if (!quote) return { success: false, error: "Devis introuvable" };

  try {
    const { document } = await storeQuotePdf({
      quote,
      organizationId: user.organizationId,
      userId: user.id,
    });

    await createQuoteActivity(
      user.organizationId,
      id,
      "PDF_GENERATED",
      "PDF généré",
      document.fileName,
      user.id,
    );

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "QUOTE_PDF_GENERATED",
      entityType: "Quote",
      entityId: id,
      entityLabel: quote.quoteNumber,
    });

    return {
      success: true,
      downloadUrl: getDocumentDownloadPath(document.id),
      printUrl: `/quotes/${id}/print`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Échec de la génération PDF",
    };
  }
}

/** @deprecated Utiliser generateQuotePrintAction */
export const generateQuotePdfPlaceholderAction = generateQuotePrintAction;
