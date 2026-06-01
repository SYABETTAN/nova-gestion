"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createItemTagSchema } from "@/lib/item-validators";

export async function assignItemTagAction(itemId: string, tagId: string) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_UPDATE");

  const item = await prisma.item.findFirst({
    where: { id: itemId, organizationId: user.organizationId },
  });
  if (!item) return { success: false, error: "Article introuvable" };

  const tag = await prisma.itemTag.findFirst({
    where: { id: tagId, organizationId: user.organizationId },
  });
  if (!tag) return { success: false, error: "Tag introuvable" };

  await prisma.itemTagAssignment.upsert({
    where: { itemId_tagId: { itemId, tagId } },
    update: {},
    create: { organizationId: user.organizationId, itemId, tagId },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ITEM_TAG_ASSIGNED",
    entityType: "ItemTag",
    entityId: tagId,
    entityLabel: `${item.name} → ${tag.name}`,
  });

  revalidatePath(`/items/${itemId}`);
  revalidatePath("/items");
  return { success: true };
}

export async function removeItemTagAction(itemId: string, tagId: string) {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_UPDATE");

  const assignment = await prisma.itemTagAssignment.findFirst({
    where: { itemId, tagId, organizationId: user.organizationId },
    include: { tag: true, item: true },
  });
  if (!assignment) return { success: false, error: "Association introuvable" };

  await prisma.itemTagAssignment.delete({ where: { itemId_tagId: { itemId, tagId } } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ITEM_TAG_REMOVED",
    entityType: "ItemTag",
    entityId: tagId,
    entityLabel: `${assignment.item.name} → ${assignment.tag.name}`,
  });

  revalidatePath(`/items/${itemId}`);
  revalidatePath("/items");
  return { success: true };
}

export async function createItemTagAction(name: string, color = "#64748b") {
  const user = await requireAuth();
  requirePermission(user, "ITEMS_UPDATE");

  const parsed = createItemTagSchema.safeParse({ name, color });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const tag = await prisma.itemTag.upsert({
    where: {
      organizationId_name: { organizationId: user.organizationId, name: parsed.data.name },
    },
    update: { color: parsed.data.color },
    create: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      color: parsed.data.color,
    },
  });

  return { success: true, tag };
}
