"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { sendPaymentReceiptSimulationSchema } from "@/lib/payment-validators";
import { getPaymentByIdQuery } from "@/lib/payments";
import { createPaymentActivity } from "@/server/actions/payment.actions";
import { prisma } from "@/lib/prisma";
import { buildPaymentReceiptEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-status";

function emailActionError(err: unknown): { success: false; error: string } | null {
  if (err instanceof Error && err.message.includes("envoi par email")) {
    return { success: false, error: err.message };
  }
  return null;
}

export async function generatePaymentReceiptAction(paymentId: string) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_READ");

  const payment = await getPaymentByIdQuery(user.organizationId, paymentId);
  if (!payment) return { success: false as const, error: "Paiement introuvable" };
  if (payment.status === "CANCELLED") {
    return { success: false as const, error: "Reçu indisponible pour un paiement annulé" };
  }

  await createPaymentActivity(
    user.organizationId,
    paymentId,
    "RECEIPT_GENERATED",
    "Reçu généré",
    "Reçu de paiement généré",
    user.id,
  );

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_RECEIPT_GENERATED",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Reçu généré pour ${payment.paymentNumber}`,
  });

  revalidatePath(`/payments/${paymentId}`);

  return {
    success: true as const,
    receiptUrl: `/payments/${paymentId}/receipt`,
  };
}

export async function sendPaymentReceiptEmailAction(paymentId: string, input: unknown) {
  try {
    const user = await requireAuth();
    requirePermission(user, "PAYMENTS_CREATE");

    const parsed = sendPaymentReceiptSimulationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
    }

    const payment = await getPaymentByIdQuery(user.organizationId, paymentId);
    if (!payment) return { success: false as const, error: "Paiement introuvable" };

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true },
    });
    if (!org) return { success: false as const, error: "Organisation introuvable" };

    const invoiceNumber =
      payment.allocations[0]?.invoice?.invoiceNumber ?? null;

    const template = buildPaymentReceiptEmail({
      organizationName: org.name,
      recipientName: payment.customer.name,
      paymentNumber: payment.paymentNumber,
      invoiceNumber,
      amount: payment.amount,
      paidAt: payment.paymentDate,
      paymentMethod: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      customMessage: parsed.data.message,
    });

    const emailResult = await sendEmail({
      to: parsed.data.recipient,
      subject: parsed.data.subject || template.subject,
      html: template.html,
      text: template.text,
      tags: [{ name: "type", value: "payment-receipt" }, { name: "paymentId", value: paymentId }],
    });

    if (!emailResult.success) {
      return { success: false as const, error: emailResult.error };
    }

    await createPaymentActivity(
      user.organizationId,
      paymentId,
      "EMAIL_SIMULATED",
      "Reçu envoyé par email",
      `Destinataire : ${parsed.data.recipient}`,
      user.id,
      { subject: parsed.data.subject || template.subject, messageId: emailResult.messageId },
    );

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "PAYMENT_RECEIPT_EMAIL_SIMULATED",
      entityType: "Payment",
      entityId: paymentId,
      entityLabel: `Email reçu pour ${payment.paymentNumber}`,
      newValues: {
        recipient: parsed.data.recipient,
        messageId: emailResult.messageId,
        provider: emailResult.provider,
      },
    });

    revalidatePath(`/payments/${paymentId}`);

    return {
      success: true as const,
      message: "Reçu de paiement envoyé par email.",
    };
  } catch (err) {
    const configError = emailActionError(err);
    if (configError) return configError;
    throw err;
  }
}

/** @deprecated Utiliser sendPaymentReceiptEmailAction */
export const sendPaymentReceiptSimulationAction = sendPaymentReceiptEmailAction;
