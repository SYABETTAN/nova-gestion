"use server";

import { revalidatePath } from "next/cache";
import type { PaymentActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import { generatePaymentsCsv } from "@/lib/csv";
import {
  buildAutoAllocations,
  getOpenInvoicesForCustomerQuery,
  recalculateCustomerOutstandingAmount,
  recalculateInvoicePaymentStatus,
  recalculatePaymentAllocationStatus,
} from "@/lib/payment-calculations";
import { computePaymentStats } from "@/lib/payment-utils";
import {
  createPaymentSchema,
  paymentFilterSchema,
  updatePaymentSchema,
} from "@/lib/payment-validators";
import {
  getCustomersForPaymentFilterQuery,
  getPaymentByIdQuery,
  getPaymentFormDataQuery,
  getPaymentsForExportQuery,
  getPaymentStatsQuery,
  getRecentPaymentsByCustomerQuery,
  listPaymentsQuery,
} from "@/lib/payments";
import { roundMoney } from "@/lib/pricing";
import { isPositive, isZero, moneyAdd, moneySub, moneyToNumber, toDbDecimal } from "@/lib/money";
import { mapMoneyFieldsToDb, PAYMENT_MONEY_FIELDS } from "@/lib/money-db";

function emptyToNull(value?: string | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

async function createPaymentActivity(
  organizationId: string,
  paymentId: string,
  type: PaymentActivityType,
  title: string,
  description?: string | null,
  userId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await prisma.paymentActivity.create({
    data: {
      organizationId,
      paymentId,
      userId: userId ?? null,
      type,
      title,
      description: description ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function createInvoicePaymentActivity(
  organizationId: string,
  invoiceId: string,
  type: "PAYMENT_RECEIVED" | "PAYMENT_CANCELLED",
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

export async function listPaymentsAction(filters: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_READ");
  const parsed = paymentFilterSchema.safeParse(filters);
  const f = parsed.success ? parsed.data : paymentFilterSchema.parse({});
  return listPaymentsQuery(user.organizationId, f);
}

export async function getPaymentByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_READ");
  return getPaymentByIdQuery(user.organizationId, id);
}

export async function getPaymentStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_READ");
  const data = await getPaymentStatsQuery(user.organizationId);
  const stats = computePaymentStats(data.payments);
  return {
    ...stats,
    paidInvoices: data.paidInvoices,
    totalOutstanding: data.totalOutstanding,
  };
}

export async function getCustomersForPaymentFilterAction() {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_READ");
  return getCustomersForPaymentFilterQuery(user.organizationId);
}

export async function getPaymentFormDataAction() {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_CREATE");
  return getPaymentFormDataQuery(user.organizationId);
}

export async function getOpenInvoicesForCustomerAction(customerId: string) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_CREATE");
  return getOpenInvoicesForCustomerQuery(customerId, user.organizationId);
}

export async function getRecentPaymentsByCustomerAction(customerId: string) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_READ");
  return getRecentPaymentsByCustomerQuery(user.organizationId, customerId);
}

export async function createPaymentAction(input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_CREATE");

  const parsed = createPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, organizationId: user.organizationId },
  });
  if (!customer) return { success: false as const, error: "Client introuvable" };

  let allocations = data.allocations ?? [];
  if (data.autoAllocate) {
    const openInvoices = await getOpenInvoicesForCustomerQuery(
      data.customerId,
      user.organizationId,
    );
    allocations = buildAutoAllocations(data.amount, openInvoices);
  }

  const totalAlloc = roundMoney(allocations.reduce((s, a) => moneyAdd(s, a.amount), moneyAdd(0, 0)));
  if (totalAlloc > data.amount) {
    return { success: false as const, error: "Le total alloué dépasse le montant du paiement" };
  }

  for (const alloc of allocations) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: alloc.invoiceId,
        customerId: data.customerId,
        organizationId: user.organizationId,
      },
    });
    if (!invoice) {
      return { success: false as const, error: "Facture introuvable ou client incohérent" };
    }
    if (moneyToNumber(alloc.amount) > moneyToNumber(invoice.amountDue)) {
      return {
        success: false as const,
        error: `Allocation supérieure au reste dû pour ${invoice.invoiceNumber}`,
      };
    }
  }

  const paymentNumber = await generateNextNumber(
    user.organizationId,
    "PAYMENT",
    user.id,
  );
  const allocatedAmount = totalAlloc;
  const unallocatedAmount = roundMoney(moneySub(data.amount, allocatedAmount));
  const status =
    !isPositive(allocatedAmount)
      ? "CONFIRMED"
      : !isPositive(unallocatedAmount)
        ? "FULLY_ALLOCATED"
        : "PARTIALLY_ALLOCATED";

  const paymentAmounts = mapMoneyFieldsToDb(
    { amount: data.amount, allocatedAmount, unallocatedAmount },
    [...PAYMENT_MONEY_FIELDS],
  );

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        organizationId: user.organizationId,
        paymentNumber,
        customerId: data.customerId,
        status,
        method: data.method,
        paymentDate: data.paymentDate,
        ...paymentAmounts,
        currency: data.currency ?? "EUR",
        reference: emptyToNull(data.reference),
        bankReference: emptyToNull(data.bankReference),
        checkNumber: emptyToNull(data.checkNumber),
        cardLast4: emptyToNull(data.cardLast4),
        notes: emptyToNull(data.notes),
        internalNotes: emptyToNull(data.internalNotes),
        receivedById: user.id,
      },
    });

    await tx.paymentActivity.create({
      data: {
        organizationId: user.organizationId,
        paymentId: created.id,
        userId: user.id,
        type: "CREATED",
        title: "Paiement créé",
        description: `Paiement ${paymentNumber} enregistré pour ${customer.name}`,
      },
    });

    for (const alloc of allocations) {
      await tx.paymentAllocation.create({
        data: {
          organizationId: user.organizationId,
          paymentId: created.id,
          invoiceId: alloc.invoiceId,
          customerId: data.customerId,
          amount: toDbDecimal(alloc.amount),
        },
      });
    }

    if (allocations.length > 0) {
      await tx.paymentActivity.create({
        data: {
          organizationId: user.organizationId,
          paymentId: created.id,
          userId: user.id,
          type: "ALLOCATED",
          title: "Paiement alloué",
          description: `${allocations.length} facture(s) réglée(s)`,
        },
      });
    }

    return created;
  });

  for (const alloc of allocations) {
    await recalculateInvoicePaymentStatus(alloc.invoiceId, user.organizationId);
    const invoice = await prisma.invoice.findUnique({ where: { id: alloc.invoiceId } });
    if (invoice) {
      await createInvoicePaymentActivity(
        user.organizationId,
        alloc.invoiceId,
        "PAYMENT_RECEIVED",
        "Paiement reçu",
        `${paymentNumber} — ${roundMoney(alloc.amount)} € alloués`,
        user.id,
      );
    }
  }

  await recalculateCustomerOutstandingAmount(data.customerId, user.organizationId);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_CREATED",
    entityType: "Payment",
    entityId: payment.id,
    entityLabel: `Paiement ${paymentNumber} créé`,
  });

  if (allocations.length > 0) {
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "PAYMENT_ALLOCATED",
      entityType: "Payment",
      entityId: payment.id,
      entityLabel: `Paiement ${paymentNumber} alloué à ${allocations.length} facture(s)`,
    });
  }

  revalidatePath("/payments");
  revalidatePath(`/payments/${payment.id}`);
  revalidatePath("/invoices");
  for (const alloc of allocations) {
    revalidatePath(`/invoices/${alloc.invoiceId}`);
  }
  revalidatePath(`/customers/${data.customerId}`);

  return { success: true as const, paymentId: payment.id };
}

export async function updatePaymentAction(id: string, input: unknown) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_UPDATE");

  const parsed = updatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const existing = await prisma.payment.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return { success: false as const, error: "Paiement introuvable" };
  if (existing.status === "CANCELLED") {
    return { success: false as const, error: "Un paiement annulé ne peut pas être modifié" };
  }

  const data = parsed.data;
  if (data.amount !== undefined && moneyToNumber(data.amount) < moneyToNumber(existing.allocatedAmount)) {
    return {
      success: false as const,
      error: "Le montant ne peut pas être inférieur au montant déjà alloué",
    };
  }

  const newAmount = data.amount ?? moneyToNumber(existing.amount);
  const unallocatedAmount = roundMoney(moneySub(newAmount, existing.allocatedAmount));
  const status =
    isZero(existing.allocatedAmount)
      ? "CONFIRMED"
      : !isPositive(unallocatedAmount)
        ? "FULLY_ALLOCATED"
        : "PARTIALLY_ALLOCATED";

  await prisma.payment.update({
    where: { id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.paymentDate ? { paymentDate: data.paymentDate } : {}),
      ...(data.amount !== undefined
        ? {
            ...mapMoneyFieldsToDb(
              { amount: data.amount, unallocatedAmount },
              ["amount", "unallocatedAmount"],
            ),
            status,
          }
        : {}),
      ...(data.method ? { method: data.method } : {}),
      ...(data.currency ? { currency: data.currency } : {}),
      reference: data.reference !== undefined ? emptyToNull(data.reference) : undefined,
      bankReference:
        data.bankReference !== undefined ? emptyToNull(data.bankReference) : undefined,
      checkNumber: data.checkNumber !== undefined ? emptyToNull(data.checkNumber) : undefined,
      cardLast4: data.cardLast4 !== undefined ? emptyToNull(data.cardLast4) : undefined,
      notes: data.notes !== undefined ? emptyToNull(data.notes) : undefined,
      internalNotes:
        data.internalNotes !== undefined ? emptyToNull(data.internalNotes) : undefined,
    },
  });

  await createPaymentActivity(
    user.organizationId,
    id,
    "UPDATED",
    "Paiement modifié",
    "Informations du paiement mises à jour",
    user.id,
  );

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_UPDATED",
    entityType: "Payment",
    entityId: id,
    entityLabel: `Paiement ${existing.paymentNumber} modifié`,
  });

  revalidatePath("/payments");
  revalidatePath(`/payments/${id}`);

  return { success: true as const };
}

export async function exportPaymentsCsvAction(
  filters: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "PAYMENTS_EXPORT");

  const parsed = paymentFilterSchema.safeParse(filters);
  const f = parsed.success ? parsed.data : {};
  const payments = await getPaymentsForExportQuery(user.organizationId, f);
  const csv = generatePaymentsCsv(payments);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_EXPORTED",
    entityType: "Payment",
    entityLabel: `Export CSV de ${payments.length} paiement(s)`,
  });

  return {
    success: true as const,
    csv,
    filename: "paiements.csv",
  };
}

export { createPaymentActivity, createInvoicePaymentActivity };
