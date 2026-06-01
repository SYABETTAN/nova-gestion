"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createSupplierTagSchema } from "@/lib/supplier-validators";

export async function assignSupplierTagAction(supplierId: string, tagId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: user.organizationId },
  });
  if (!supplier) return { success: false, error: "Fournisseur introuvable" };

  const tag = await prisma.supplierTag.findFirst({
    where: { id: tagId, organizationId: user.organizationId },
  });
  if (!tag) return { success: false, error: "Tag introuvable" };

  await prisma.supplierTagAssignment.upsert({
    where: { supplierId_tagId: { supplierId, tagId } },
    update: {},
    create: { organizationId: user.organizationId, supplierId, tagId },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_TAG_ASSIGNED",
    entityType: "Supplier",
    entityId: supplierId,
    entityLabel: `${supplier.name} — ${tag.name}`,
  });

  revalidatePath(`/suppliers/${supplierId}`);
  return { success: true };
}

export async function removeSupplierTagAction(supplierId: string, tagId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  await prisma.supplierTagAssignment.deleteMany({
    where: { supplierId, tagId, organizationId: user.organizationId },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_TAG_REMOVED",
    entityType: "Supplier",
    entityId: supplierId,
    entityLabel: tagId,
  });

  revalidatePath(`/suppliers/${supplierId}`);
  return { success: true };
}

export async function createSupplierTagAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const parsed = createSupplierTagSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const tag = await prisma.supplierTag.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      color: parsed.data.color ?? "#64748b",
    },
  });

  revalidatePath("/suppliers");
  return { success: true, tagId: tag.id };
}
