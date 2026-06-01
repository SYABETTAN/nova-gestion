"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createSupplierBankAccountSchema,
  updateSupplierBankAccountSchema,
} from "@/lib/supplier-validators";

function revalidateSupplier(supplierId: string) {
  revalidatePath(`/suppliers/${supplierId}`);
}

export async function createSupplierBankAccountAction(supplierId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_BANK_DETAILS_UPDATE");

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: user.organizationId },
  });
  if (!supplier) return { success: false, error: "Fournisseur introuvable" };

  const parsed = createSupplierBankAccountSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const count = await prisma.supplierBankAccount.count({ where: { supplierId } });
  const isDefault = data.isDefault ?? count === 0;

  if (isDefault) {
    await prisma.supplierBankAccount.updateMany({
      where: { supplierId, organizationId: user.organizationId },
      data: { isDefault: false },
    });
  }

  const account = await prisma.supplierBankAccount.create({
    data: {
      organizationId: user.organizationId,
      supplierId,
      label: data.label,
      iban: data.iban,
      bic: data.bic || null,
      bankName: data.bankName || null,
      accountHolder: data.accountHolder || null,
      isDefault,
      isActive: true,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_BANK_ACCOUNT_CREATED",
    entityType: "SupplierBankAccount",
    entityId: account.id,
    entityLabel: data.label,
  });

  revalidateSupplier(supplierId);
  return { success: true };
}

export async function updateSupplierBankAccountAction(accountId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_BANK_DETAILS_UPDATE");

  const existing = await prisma.supplierBankAccount.findFirst({
    where: { id: accountId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Compte introuvable" };

  const parsed = updateSupplierBankAccountSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  if (data.isDefault) {
    await prisma.supplierBankAccount.updateMany({
      where: { supplierId: existing.supplierId, organizationId: user.organizationId },
      data: { isDefault: false },
    });
  }

  const account = await prisma.supplierBankAccount.update({
    where: { id: accountId },
    data: {
      label: data.label,
      iban: data.iban,
      bic: data.bic || null,
      bankName: data.bankName || null,
      accountHolder: data.accountHolder || null,
      isDefault: data.isDefault ?? existing.isDefault,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_BANK_ACCOUNT_UPDATED",
    entityType: "SupplierBankAccount",
    entityId: account.id,
    entityLabel: account.label,
  });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}

export async function disableSupplierBankAccountAction(accountId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_BANK_DETAILS_UPDATE");

  const existing = await prisma.supplierBankAccount.findFirst({
    where: { id: accountId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Compte introuvable" };

  await prisma.supplierBankAccount.update({
    where: { id: accountId },
    data: { isActive: false, isDefault: false },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_BANK_ACCOUNT_DISABLED",
    entityType: "SupplierBankAccount",
    entityId: accountId,
    entityLabel: existing.label,
  });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}

export async function setDefaultSupplierBankAccountAction(accountId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_BANK_DETAILS_UPDATE");

  const existing = await prisma.supplierBankAccount.findFirst({
    where: { id: accountId, organizationId: user.organizationId, isActive: true },
  });
  if (!existing) return { success: false, error: "Compte introuvable" };

  await prisma.supplierBankAccount.updateMany({
    where: { supplierId: existing.supplierId, organizationId: user.organizationId },
    data: { isDefault: false },
  });
  await prisma.supplierBankAccount.update({ where: { id: accountId }, data: { isDefault: true } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_BANK_ACCOUNT_SET_DEFAULT",
    entityType: "SupplierBankAccount",
    entityId: accountId,
    entityLabel: existing.label,
  });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}
