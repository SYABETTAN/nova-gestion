"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createSupplierCategorySchema } from "@/lib/supplier-validators";

export async function createSupplierCategoryAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_CREATE");

  const parsed = createSupplierCategorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const category = await prisma.supplierCategory.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      color: parsed.data.color ?? "#64748b",
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_CATEGORY_CREATED",
    entityType: "SupplierCategory",
    entityId: category.id,
    entityLabel: category.name,
  });

  revalidatePath("/suppliers");
  revalidatePath("/suppliers/new");
  return { success: true, categoryId: category.id };
}
