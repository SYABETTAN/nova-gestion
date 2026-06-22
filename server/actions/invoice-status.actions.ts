"use server";

import { revalidatePath } from "next/cache";
import type { InvoiceActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { resolveOrganizationDisplayName } from "@/lib/organization-display";
import { calculateInvoiceTotals, isBillableLineType } from "@/lib/invoice-calculations";
import {
  canCancelInvoice,
  canMarkOverdue,
  canMarkPaid,
  canMarkPartiallyPaid,
  canSendInvoice,
  canValidateInvoice,
} from "@/lib/invoice-status";
import {
  markInvoicePartiallyPaidSchema,
  sendInvoiceSimulationSchema,
} from "@/lib/invoice-validators";
import {
  blockSimulatedActionInProduction,
  FEATURE_MESSAGES,
} from "@/lib/feature-availability";
import { absoluteUrl } from "@/lib/email/app-url";
import { buildInvoiceEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { getDocumentDownloadPath } from "@/lib/documents/document-storage";
import { storeInvoicePdf } from "@/lib/documents/pdf-service";
import { getStorageProvider } from "@/lib/storage";
import { money, moneySub, toDbDecimal } from "@/lib/money";

async function createInvoiceActivity(
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

async function getInvoiceOrFail(organizationId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, organizationId },
    include: { lines: true, customer: { select: { name: true } }, organization: { select: { name: true } } },
  });
}

function emailActionError(err: unknown): { success: false; error: string } | null {
  if (err instanceof Error && err.message.includes("envoi par email")) {
    return { success: false, error: err.message };
  }
  return null;
}

export async function validateInvoiceAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_VALIDATE");

  const invoice = await getInvoiceOrFail(user.organizationId, id);
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canValidateInvoice(invoice.status)) {
    return { success: false, error: "Seules les factures brouillon peuvent être validées" };
  }

  const billableLines = invoice.lines.filter((l) => isBillableLineType(l.lineType));
  if (billableLines.length === 0) {
    return { success: false, error: "Au moins une ligne facturable est requise" };
  }

  const totals = calculateInvoiceTotals({
    lines: invoice.lines.map((l) => ({
      lineType: l.lineType,
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountType: l.discountType,
      discountValue: l.discountValue,
      vatRate: l.vatRate,
    })),
    globalDiscountType: invoice.globalDiscountType,
    globalDiscountValue: invoice.globalDiscountValue,
    shippingAmountExcludingTax: invoice.shippingAmountExcludingTax,
    otherFeesExcludingTax: invoice.otherFeesExcludingTax,
    amountPaid: invoice.amountPaid,
  });

  await prisma.invoice.update({
    where: { id },
    data: {
      status: "VALIDATED",
      validatedAt: new Date(),
      subtotalExcludingTax: totals.subtotalExcludingTax,
      totalDiscountAmount: totals.totalDiscountAmount,
      totalExcludingTax: totals.totalExcludingTax,
      totalVatAmount: totals.totalVatAmount,
      totalIncludingTax: totals.totalIncludingTax,
      amountDue: totals.amountDue,
    },
  });

  await createInvoiceActivity(
    user.organizationId,
    id,
    "VALIDATED",
    "Facture validée",
    "Facture verrouillée après validation",
    user.id,
  );

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_VALIDATED",
    entityType: "Invoice",
    entityId: id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return {
    success: true,
    message: "Facture validée — modification directe désactivée dans la ",
  };
}

export async function sendInvoiceEmailAction(id: string, formData: FormData) {
  try {
    const user = await requireAuth();
    requirePermission(user, "INVOICES_UPDATE");

    const invoice = await getInvoiceOrFail(user.organizationId, id);
    if (!invoice) return { success: false, error: "Facture introuvable" };

    if (invoice.status === "DRAFT") {
      return { success: false, error: "Validez la facture avant de l'envoyer." };
    }

    if (!canSendInvoice(invoice.status)) {
      return { success: false, error: "Action non autorisée pour ce statut" };
    }

    const parsed = sendInvoiceSimulationSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
    }

    const data = parsed.data;

    let pdfBuffer: Buffer | null = null;
    let pdfFileName = `facture-${invoice.invoiceNumber}.pdf`;
    let pdfDocumentId: string | null = null;
    try {
      const { document } = await storeInvoicePdf({
        invoice,
        organizationId: user.organizationId,
        userId: user.id,
      });
      pdfFileName = document.fileName;
      pdfDocumentId = document.id;
      pdfBuffer = await getStorageProvider().get(document.storageKey);
    } catch (pdfErr) {
      console.error("[invoice-email] PDF generation failed", pdfErr);
    }

    const template = buildInvoiceEmail({
      organizationName: resolveOrganizationDisplayName(
        invoice.organization.name,
        invoice.organization.slug,
      ),
      recipientName: invoice.customer.name,
      invoiceNumber: invoice.invoiceNumber,
      invoiceTitle: invoice.title,
      totalIncludingTax: invoice.totalIncludingTax,
      amountDue: invoice.amountDue,
      dueDate: invoice.dueDate,
      customMessage: data.message,
      documentUrl: pdfDocumentId
        ? absoluteUrl(getDocumentDownloadPath(pdfDocumentId))
        : absoluteUrl(`/invoices/${id}/print`),
    });

    const emailResult = await sendEmail({
      to: data.recipient,
      subject: data.subject || template.subject,
      html: template.html,
      text: template.text,
      tags: [{ name: "type", value: "invoice" }, { name: "invoiceId", value: id }],
      attachments: pdfBuffer
        ? [{ filename: pdfFileName, content: pdfBuffer }]
        : undefined,
    });

    if (!emailResult.success) {
      return { success: false, error: emailResult.error };
    }

    const updates: { status?: "SENT"; sentAt?: Date } = {};
    if (invoice.status === "VALIDATED") {
      updates.status = "SENT";
      updates.sentAt = new Date();
    }

    if (Object.keys(updates).length > 0) {
      await prisma.invoice.update({ where: { id }, data: updates });
    }

    await createInvoiceActivity(
      user.organizationId,
      id,
      "EMAIL_SIMULATED",
      "Email envoyé",
      `Destinataire : ${data.recipient}`,
      user.id,
    );

    if (updates.status === "SENT") {
      await createInvoiceActivity(user.organizationId, id, "SENT", "Facture envoyée", null, user.id);
    }

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "INVOICE_EMAIL_SIMULATED",
      entityType: "Invoice",
      entityId: id,
      entityLabel: invoice.invoiceNumber,
      newValues: {
        recipient: data.recipient,
        subject: data.subject || template.subject,
        messageId: emailResult.messageId,
        provider: emailResult.provider,
      },
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { success: true, message: "Facture envoyée par email." };
  } catch (err) {
    const configError = emailActionError(err);
    if (configError) return configError;
    throw err;
  }
}

/** @deprecated Utiliser sendInvoiceEmailAction */
export const sendInvoiceSimulationAction = sendInvoiceEmailAction;

export async function markInvoiceOverdueAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_VALIDATE");

  const invoice = await getInvoiceOrFail(user.organizationId, id);
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canMarkOverdue(invoice.status)) {
    return { success: false, error: "Action non autorisée pour ce statut" };
  }

  await prisma.invoice.update({
    where: { id },
    data: { status: "OVERDUE", paymentStatus: "OVERDUE" },
  });

  await createInvoiceActivity(user.organizationId, id, "MARKED_OVERDUE", "Facture en retard", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_MARKED_OVERDUE",
    entityType: "Invoice",
    entityId: id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function markInvoicePaidPlaceholderAction(id: string) {
  const blocked = blockSimulatedActionInProduction(FEATURE_MESSAGES.paymentUseModule);
  if (blocked) return blocked;

  const user = await requireAuth();
  requirePermission(user, "INVOICES_VALIDATE");

  const invoice = await getInvoiceOrFail(user.organizationId, id);
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canMarkPaid(invoice.status)) {
    return { success: false, error: "Action non autorisée pour ce statut" };
  }

  await prisma.invoice.update({
    where: { id },
    data: {
      status: "PAID",
      paymentStatus: "PAID",
      amountPaid: invoice.totalIncludingTax,
      amountDue: 0,
      paidAt: new Date(),
    },
  });

  await createInvoiceActivity(
    user.organizationId,
    id,
    "MARKED_PAID_PLACEHOLDER",
    "Paiement simulé",
    "Module Paiements à venir",
    user.id,
  );

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_MARKED_PAID_PLACEHOLDER",
    entityType: "Invoice",
    entityId: id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return {
    success: true,
    message: "Paiement simulé — le module Paiements sera développé ensuite.",
  };
}

export async function markInvoicePartiallyPaidPlaceholderAction(id: string, formData: FormData) {
  const blocked = blockSimulatedActionInProduction(FEATURE_MESSAGES.paymentUseModule);
  if (blocked) return blocked;

  const user = await requireAuth();
  requirePermission(user, "INVOICES_VALIDATE");

  const invoice = await getInvoiceOrFail(user.organizationId, id);
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canMarkPartiallyPaid(invoice.status)) {
    return { success: false, error: "Action non autorisée pour ce statut" };
  }

  const parsed = markInvoicePartiallyPaidSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Montant invalide" };
  }

  const amount = parsed.data.amount;
  if (money(amount).greaterThan(invoice.totalIncludingTax)) {
    return { success: false, error: "Le montant ne peut pas dépasser le total TTC" };
  }

  const amountDue = moneySub(invoice.totalIncludingTax, amount);
  const isFullyPaid = money(amountDue).isZero();

  await prisma.invoice.update({
    where: { id },
    data: {
      status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
      paymentStatus: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
      amountPaid: toDbDecimal(amount),
      amountDue: toDbDecimal(amountDue),
      paidAt: isFullyPaid ? new Date() : null,
    },
  });

  await createInvoiceActivity(
    user.organizationId,
    id,
    "PARTIAL_PAYMENT_PLACEHOLDER",
    "Paiement partiel simulé",
    `${amount} € enregistrés`,
    user.id,
  );

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_PARTIAL_PAYMENT_PLACEHOLDER",
    entityType: "Invoice",
    entityId: id,
    entityLabel: invoice.invoiceNumber,
    newValues: { amount },
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true, message: "Paiement partiel simulé enregistré." };
}

export async function cancelInvoiceAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_CANCEL");

  const invoice = await getInvoiceOrFail(user.organizationId, id);
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canCancelInvoice(invoice.status)) {
    return { success: false, error: "Cette facture ne peut pas être annulée" };
  }

  await prisma.invoice.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await createInvoiceActivity(user.organizationId, id, "CANCELLED", "Facture annulée", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_CANCELLED",
    entityType: "Invoice",
    entityId: id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function generateInvoicePrintAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");

  const invoice = await getInvoiceOrFail(user.organizationId, id);
  if (!invoice) return { success: false, error: "Facture introuvable" };

  try {
    const { document } = await storeInvoicePdf({
      invoice,
      organizationId: user.organizationId,
      userId: user.id,
    });

    await createInvoiceActivity(
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
      action: "INVOICE_PDF_GENERATED",
      entityType: "Invoice",
      entityId: id,
      entityLabel: invoice.invoiceNumber,
    });

    return {
      success: true,
      downloadUrl: getDocumentDownloadPath(document.id),
      printUrl: `/invoices/${id}/print`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Échec de la génération PDF",
    };
  }
}

/** @deprecated Utiliser generateInvoicePrintAction */
export const generateInvoicePdfPlaceholderAction = generateInvoicePrintAction;
