"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  buildAutoAllocations,
  getOpenInvoicesForCustomerQuery,
  recalculateCustomerOutstandingAmount,
  recalculateInvoicePaymentStatus,
  recalculatePaymentAllocationStatus,
} from "@/lib/payment-calculations";
import {
  allocatePaymentSchema,
  cancelPaymentSchema,
  deallocatePaymentSchema,
} from "@/lib/payment-validators";
import { roundMoney } from "@/lib/pricing";
import { money, moneyAdd, toDbDecimal } from "@/lib/money";
import {
  createInvoicePaymentActivity,
  createPaymentActivity,
} from "@/server/actions/payment.actions";

export async function allocatePaymentAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_UPDATE");

  const parsed = allocatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { paymentId, allocations } = parsed.data;
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, organizationId: user.organizationId },
  });
  if (!payment) return { success: false as const, error: "Paiement introuvable" };
  if (payment.status === "CANCELLED") {
    return { success: false as const, error: "Paiement annulé — allocation impossible" };
  }

  const totalNew = roundMoney(allocations.reduce((s, a) => s + a.amount, 0));
  if (money(totalNew).greaterThan(payment.unallocatedAmount)) {
    return {
      success: false as const,
      error: "Le montant alloué dépasse le montant non alloué du paiement",
    };
  }

  for (const alloc of allocations) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: alloc.invoiceId,
        customerId: payment.customerId,
        organizationId: user.organizationId,
      },
    });
    if (!invoice) {
      return { success: false as const, error: "Facture introuvable ou client incohérent" };
    }
    if (money(alloc.amount).greaterThan(invoice.amountDue)) {
      return {
        success: false as const,
        error: `Allocation supérieure au reste dû pour ${invoice.invoiceNumber}`,
      };
    }
  }

  const affectedInvoices: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const alloc of allocations) {
      const existing = await tx.paymentAllocation.findUnique({
        where: {
          paymentId_invoiceId: { paymentId, invoiceId: alloc.invoiceId },
        },
      });
      if (existing) {
        await tx.paymentAllocation.update({
          where: { id: existing.id },
          data: { amount: toDbDecimal(moneyAdd(existing.amount, alloc.amount)) },
        });
      } else {
        await tx.paymentAllocation.create({
          data: {
            organizationId: user.organizationId,
            paymentId,
            invoiceId: alloc.invoiceId,
            customerId: payment.customerId,
            amount: alloc.amount,
          },
        });
      }
      affectedInvoices.push(alloc.invoiceId);
    }

    await tx.paymentActivity.create({
      data: {
        organizationId: user.organizationId,
        paymentId,
        userId: user.id,
        type: "ALLOCATED",
        title: "Allocation effectuée",
        description: `${allocations.length} facture(s) — ${totalNew} €`,
      },
    });
  });

  await recalculatePaymentAllocationStatus(paymentId, user.organizationId);

  for (const invoiceId of affectedInvoices) {
    await recalculateInvoicePaymentStatus(invoiceId, user.organizationId);
    await createInvoicePaymentActivity(
      user.organizationId,
      invoiceId,
      "PAYMENT_RECEIVED",
      "Paiement reçu",
      `${payment.paymentNumber} — allocation enregistrée`,
      user.id,
    );
  }

  await recalculateCustomerOutstandingAmount(payment.customerId, user.organizationId);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_ALLOCATED",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Allocation de ${totalNew} € sur ${payment.paymentNumber}`,
  });

  revalidatePath("/payments");
  revalidatePath(`/payments/${paymentId}`);
  revalidatePath("/invoices");

  return { success: true as const };
}

export async function autoAllocatePaymentAction(paymentId: string) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_UPDATE");

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, organizationId: user.organizationId },
  });
  if (!payment) return { success: false as const, error: "Paiement introuvable" };
  if (payment.status === "CANCELLED") {
    return { success: false as const, error: "Paiement annulé" };
  }
  if (money(payment.unallocatedAmount).lessThanOrEqualTo(0)) {
    return { success: false as const, error: "Aucun montant à allouer" };
  }

  const openInvoices = await getOpenInvoicesForCustomerQuery(
    payment.customerId,
    user.organizationId,
  );
  const allocations = buildAutoAllocations(payment.unallocatedAmount, openInvoices);
  if (allocations.length === 0) {
    return { success: false as const, error: "Aucune facture ouverte à régler" };
  }

  return allocatePaymentAction({ paymentId, allocations });
}

export async function deallocatePaymentFromInvoiceAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_UPDATE");

  const parsed = deallocatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { paymentId, invoiceId } = parsed.data;
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, organizationId: user.organizationId },
  });
  if (!payment) return { success: false as const, error: "Paiement introuvable" };
  if (payment.status === "CANCELLED") {
    return { success: false as const, error: "Paiement annulé" };
  }

  const allocation = await prisma.paymentAllocation.findUnique({
    where: { paymentId_invoiceId: { paymentId, invoiceId } },
    include: { invoice: { select: { invoiceNumber: true } } },
  });
  if (!allocation) {
    return { success: false as const, error: "Allocation introuvable" };
  }

  await prisma.paymentAllocation.delete({ where: { id: allocation.id } });

  await createPaymentActivity(
    user.organizationId,
    paymentId,
    "DEALLOCATED",
    "Désallocation effectuée",
    `Facture ${allocation.invoice.invoiceNumber} — ${allocation.amount} €`,
    user.id,
  );

  await recalculatePaymentAllocationStatus(paymentId, user.organizationId);
  await recalculateInvoicePaymentStatus(invoiceId, user.organizationId);
  await recalculateCustomerOutstandingAmount(payment.customerId, user.organizationId);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_DEALLOCATED",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Désallocation de ${allocation.amount} € sur ${payment.paymentNumber}`,
  });

  revalidatePath("/payments");
  revalidatePath(`/payments/${paymentId}`);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);

  return { success: true as const };
}

export async function cancelPaymentAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_CANCEL");

  const parsed = cancelPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { paymentId, reason } = parsed.data;
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, organizationId: user.organizationId },
    include: { allocations: true },
  });
  if (!payment) return { success: false as const, error: "Paiement introuvable" };
  if (payment.status === "CANCELLED") {
    return { success: false as const, error: "Paiement déjà annulé" };
  }

  const invoiceIds = payment.allocations.map((a) => a.invoiceId);

  await prisma.$transaction(async (tx) => {
    await tx.paymentAllocation.deleteMany({ where: { paymentId } });
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
        allocatedAmount: 0,
        unallocatedAmount: 0,
      },
    });
    await tx.paymentActivity.create({
      data: {
        organizationId: user.organizationId,
        paymentId,
        userId: user.id,
        type: "CANCELLED",
        title: "Paiement annulé",
        description: reason,
      },
    });
  });

  for (const invoiceId of invoiceIds) {
    await recalculateInvoicePaymentStatus(invoiceId, user.organizationId);
    await createInvoicePaymentActivity(
      user.organizationId,
      invoiceId,
      "PAYMENT_CANCELLED",
      "Paiement annulé",
      `${payment.paymentNumber} — ${reason}`,
      user.id,
    );
  }

  await recalculateCustomerOutstandingAmount(payment.customerId, user.organizationId);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_CANCELLED",
    entityType: "Payment",
    entityId: paymentId,
    entityLabel: `Paiement ${payment.paymentNumber} annulé : ${reason}`,
  });

  revalidatePath("/payments");
  revalidatePath(`/payments/${paymentId}`);
  revalidatePath("/invoices");
  revalidatePath(`/customers/${payment.customerId}`);

  return { success: true as const, message: "Paiement annulé" };
}
