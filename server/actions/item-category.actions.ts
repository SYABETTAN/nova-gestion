"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createItemCategorySchema } from "@/lib/item-validators";

export async function createItemCategoryAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_CREATE");

  const parsed = createItemCategorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const category = await prisma.itemCategory.upsert({
    where: {
      organizationId_name: {
        organizationId: user.organizationId,
        name: parsed.data.name,
      },
    },
    update: { description: parsed.data.description, color: parsed.data.color },
    create: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ITEM_CATEGORY_CREATED",
    entityType: "ItemCategory",
    entityId: category.id,
    entityLabel: category.name,
  });

  revalidatePath("/items");
  return { success: true, category };
}
