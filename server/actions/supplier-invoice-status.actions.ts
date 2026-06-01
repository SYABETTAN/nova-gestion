"use server";

import type { SupplierInvoiceActivityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  canCancelSupplierInvoice,
  canMarkSupplierInvoiceOverdue,
  canMarkSupplierInvoicePaid,
  canValidateSupplierInvoice,
  isSupplierInvoiceOverdue,
  recalculateSupplierInvoicePaymentStatus,
} from "@/lib/supplier-invoice-status";
import {
  cancelSupplierInvoiceSchema,
  markSupplierInvoicePartiallyPaidSchema,
} from "@/lib/supplier-invoice-validators";
import {
  blockSimulatedActionInProduction,
  FEATURE_MESSAGES,
} from "@/lib/feature-availability";
import { money, moneySub, toDbDecimal } from "@/lib/money";

async function createActivity(
  organizationId: string,
  supplierInvoiceId: string,
  type: SupplierInvoiceActivityType,
  title: string,
  description?: string | null,
  userId?: string | null,
) {
  await prisma.supplierInvoiceActivity.create({
    data: {
      organizationId,
      supplierInvoiceId,
      userId: userId ?? null,
      type,
      title,
      description: description ?? null,
    },
  });
}

function revalidateInvoice(id: string, supplierId?: string) {
  revalidatePath("/supplier-invoices");
  revalidatePath(`/supplier-invoices/${id}`);
  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
}

export async function validateSupplierInvoiceAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_VALIDATE");

  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { lines: true },
  });
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canValidateSupplierInvoice(invoice.status)) {
    return { success: false, error: "Seul un brouillon peut être validé" };
  }
  if (invoice.lines.length === 0) {
    return { success: false, error: "Au moins une ligne est requise" };
  }

  const paymentStatus = recalculateSupplierInvoicePaymentStatus({
    status: "VALIDATED",
    paymentStatus: invoice.paymentStatus,
    dueDate: invoice.dueDate,
    totalIncludingTax: invoice.totalIncludingTax,
    amountPaid: invoice.amountPaid,
    amountDue: invoice.amountDue,
  });

  await prisma.supplierInvoice.update({
    where: { id },
    data: {
      status: "VALIDATED",
      validatedAt: new Date(),
      paymentStatus,
    },
  });

  await createActivity(user.organizationId, id, "VALIDATED", "Facture validée", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_VALIDATED",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: invoice.supplierInvoiceNumber,
  });

  revalidateInvoice(id, invoice.supplierId);
  return { success: true, message: "Facture fournisseur validée" };
}

export async function cancelSupplierInvoiceAction(id: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_CANCEL");

  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canCancelSupplierInvoice(invoice.status)) {
    return { success: false, error: "Cette facture ne peut pas être annulée" };
  }

  const parsed = cancelSupplierInvoiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  await prisma.supplierInvoice.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await createActivity(
    user.organizationId,
    id,
    "CANCELLED",
    "Facture annulée",
    parsed.data.reason,
    user.id,
  );
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_CANCELLED",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: invoice.supplierInvoiceNumber,
  });

  revalidateInvoice(id, invoice.supplierId);
  return { success: true };
}

export async function markSupplierInvoicePaidPlaceholderAction(id: string) {
  const blocked = blockSimulatedActionInProduction(FEATURE_MESSAGES.supplierPaymentUseModule);
  if (blocked) return blocked;

  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canMarkSupplierInvoicePaid(invoice.status)) {
    return { success: false, error: "Seule une facture validée peut être marquée payée" };
  }

  await prisma.supplierInvoice.update({
    where: { id },
    data: {
      paymentStatus: "PAID",
      amountPaid: invoice.totalIncludingTax,
      amountDue: 0,
      paidAt: new Date(),
    },
  });

  await createActivity(
    user.organizationId,
    id,
    "MARKED_PAID_PLACEHOLDER",
    "Paiement fournisseur simulé",
    "Module paiements fournisseurs",
    user.id,
  );
  await prisma.supplierActivity.create({
    data: {
      organizationId: user.organizationId,
      supplierId: invoice.supplierId,
      type: "PAYMENT_PLACEHOLDER",
      title: `Paiement simulé — ${invoice.supplierInvoiceNumber}`,
      amount: invoice.totalIncludingTax,
    },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_MARKED_PAID_PLACEHOLDER",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: invoice.supplierInvoiceNumber,
  });

  revalidateInvoice(id, invoice.supplierId);
  return {
    success: true,
    message: "Paiement fournisseur simulé — le module Paiements fournisseurs sera développé ensuite.",
  };
}

export async function markSupplierInvoicePartiallyPaidPlaceholderAction(
  id: string,
  formData: FormData,
) {
  const blocked = blockSimulatedActionInProduction(FEATURE_MESSAGES.supplierPaymentUseModule);
  if (blocked) return blocked;

  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (invoice.status !== "VALIDATED") {
    return { success: false, error: "Seule une facture validée peut recevoir un paiement partiel" };
  }

  const parsed = markSupplierInvoicePartiallyPaidSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const amount = parsed.data.amount;
  if (!money(amount).lessThan(invoice.totalIncludingTax)) {
    return { success: false, error: "Le montant doit être inférieur au total TTC" };
  }

  const amountDue = moneySub(invoice.totalIncludingTax, amount);

  await prisma.supplierInvoice.update({
    where: { id },
    data: {
      paymentStatus: "PARTIALLY_PAID",
      amountPaid: toDbDecimal(amount),
      amountDue: toDbDecimal(amountDue),
    },
  });

  await createActivity(
    user.organizationId,
    id,
    "PARTIAL_PAYMENT_PLACEHOLDER",
    "Paiement partiel simulé",
    `${amount} €`,
    user.id,
  );
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_PARTIAL_PAYMENT_PLACEHOLDER",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: invoice.supplierInvoiceNumber,
  });

  revalidateInvoice(id, invoice.supplierId);
  return { success: true };
}

export async function markSupplierInvoiceOverdueAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canMarkSupplierInvoiceOverdue(invoice.status)) {
    return { success: false, error: "Action non disponible pour cette facture" };
  }
  if (!isSupplierInvoiceOverdue(invoice.dueDate, invoice.amountDue)) {
    return { success: false, error: "La facture n'est pas en retard" };
  }

  await prisma.supplierInvoice.update({
    where: { id },
    data: { paymentStatus: "OVERDUE" },
  });

  await createActivity(user.organizationId, id, "MARKED_OVERDUE", "Facture marquée en retard", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_MARKED_OVERDUE",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: invoice.supplierInvoiceNumber,
  });

  revalidateInvoice(id, invoice.supplierId);
  return { success: true };
}

export async function recalculateSupplierInvoicePaymentStatusAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_READ");

  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false, error: "Facture introuvable" };

  const paymentStatus = recalculateSupplierInvoicePaymentStatus({
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    dueDate: invoice.dueDate,
    totalIncludingTax: invoice.totalIncludingTax,
    amountPaid: invoice.amountPaid,
    amountDue: invoice.amountDue,
  });

  if (paymentStatus !== invoice.paymentStatus) {
    await prisma.supplierInvoice.update({
      where: { id },
      data: { paymentStatus },
    });
    revalidateInvoice(id, invoice.supplierId);
  }

  return { success: true, paymentStatus };
}
