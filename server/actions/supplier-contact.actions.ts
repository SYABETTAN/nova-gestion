"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createSupplierContactSchema,
  updateSupplierContactSchema,
} from "@/lib/supplier-validators";

async function getSupplierForOrg(supplierId: string, organizationId: string) {
  return prisma.supplier.findFirst({ where: { id: supplierId, organizationId } });
}

function revalidateSupplier(supplierId: string) {
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
}

export async function createSupplierContactAction(supplierId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const supplier = await getSupplierForOrg(supplierId, user.organizationId);
  if (!supplier) return { success: false, error: "Fournisseur introuvable" };

  const parsed = createSupplierContactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const existingCount = await prisma.supplierContact.count({
    where: { supplierId, organizationId: user.organizationId },
  });
  const isPrimary = data.isPrimary ?? existingCount === 0;

  if (isPrimary) {
    await prisma.supplierContact.updateMany({
      where: { supplierId, organizationId: user.organizationId },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.supplierContact.create({
    data: {
      organizationId: user.organizationId,
      supplierId,
      firstName: data.firstName,
      lastName: data.lastName,
      jobTitle: data.jobTitle || null,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      isPrimary,
      notes: data.notes || null,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_CONTACT_CREATED",
    entityType: "SupplierContact",
    entityId: contact.id,
    entityLabel: `${data.firstName} ${data.lastName}`,
  });

  revalidateSupplier(supplierId);
  return { success: true };
}

export async function updateSupplierContactAction(contactId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const existing = await prisma.supplierContact.findFirst({
    where: { id: contactId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Contact introuvable" };

  const parsed = updateSupplierContactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  if (data.isPrimary) {
    await prisma.supplierContact.updateMany({
      where: { supplierId: existing.supplierId, organizationId: user.organizationId },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.supplierContact.update({
    where: { id: contactId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      jobTitle: data.jobTitle || null,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      isPrimary: data.isPrimary ?? existing.isPrimary,
      notes: data.notes || null,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_CONTACT_UPDATED",
    entityType: "SupplierContact",
    entityId: contact.id,
    entityLabel: `${contact.firstName} ${contact.lastName}`,
  });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}

export async function deleteSupplierContactAction(contactId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const existing = await prisma.supplierContact.findFirst({
    where: { id: contactId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Contact introuvable" };

  await prisma.supplierContact.delete({ where: { id: contactId } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_CONTACT_DELETED",
    entityType: "SupplierContact",
    entityId: contactId,
    entityLabel: `${existing.firstName} ${existing.lastName}`,
  });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}

export async function setPrimarySupplierContactAction(contactId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const existing = await prisma.supplierContact.findFirst({
    where: { id: contactId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Contact introuvable" };

  await prisma.supplierContact.updateMany({
    where: { supplierId: existing.supplierId, organizationId: user.organizationId },
    data: { isPrimary: false },
  });
  await prisma.supplierContact.update({ where: { id: contactId }, data: { isPrimary: true } });

  revalidateSupplier(existing.supplierId);
  return { success: true };
}
