"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createSupplierAddressSchema,
  updateSupplierAddressSchema,
} from "@/lib/supplier-validators";

function revalidateSupplier(supplierId: string) {
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
}

export async function createSupplierAddressAction(supplierId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: user.organizationId },
  });
  if (!supplier) return { success: false, error: "Fournisseur introuvable" };

  const parsed = createSupplierAddressSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const count = await prisma.supplierAddress.count({ where: { supplierId } });
  const isDefault = data.isDefault ?? count === 0;

  if (isDefault) {
    await prisma.supplierAddress.updateMany({
      where: { supplierId, organizationId: user.organizationId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.supplierAddress.create({
    data: {
      organizationId: user.organizationId,
      supplierId,
      type: data.type,
      label: data.label || null,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      postalCode: data.postalCode,
      city: data.city,
      region: data.region || null,
      country: data.country ?? "FR",
      isDefault,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_ADDRESS_CREATED",
    entityType: "SupplierAddress",
    entityId: address.id,
    entityLabel: `${data.city} — ${data.addressLine1}`,
  });

  revalidateSupplier(supplierId);
  return { success: true };
}

export async function updateSupplierAddressAction(addressId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const existing = await prisma.supplierAddress.findFirst({
    where: { id: addressId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Adresse introuvable" };

  const parsed = updateSupplierAddressSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  if (data.isDefault) {
    await prisma.supplierAddress.updateMany({
      where: { supplierId: existing.supplierId, organizationId: user.organizationId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.supplierAddress.update({
    where: { id: addressId },
    data: {
      type: data.type,
      label: data.label || null,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      postalCode: data.postalCode,
      city: data.city,
      region: data.region || null,
      country: data.country ?? "FR",
      isDefault: data.isDefault ?? existing.isDefault,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_ADDRESS_UPDATED",
    entityType: "SupplierAddress",
    entityId: address.id,
    entityLabel: `${address.city} — ${address.addressLine1}`,
  });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}

export async function deleteSupplierAddressAction(addressId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const existing = await prisma.supplierAddress.findFirst({
    where: { id: addressId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Adresse introuvable" };

  await prisma.supplierAddress.delete({ where: { id: addressId } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_ADDRESS_DELETED",
    entityType: "SupplierAddress",
    entityId: addressId,
    entityLabel: `${existing.city} — ${existing.addressLine1}`,
  });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}

export async function setDefaultSupplierAddressAction(addressId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const existing = await prisma.supplierAddress.findFirst({
    where: { id: addressId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Adresse introuvable" };

  await prisma.supplierAddress.updateMany({
    where: { supplierId: existing.supplierId, organizationId: user.organizationId },
    data: { isDefault: false },
  });
  await prisma.supplierAddress.update({ where: { id: addressId }, data: { isDefault: true } });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}
