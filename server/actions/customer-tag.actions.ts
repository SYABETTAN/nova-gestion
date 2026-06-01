"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function assignCustomerTagAction(customerId: string, tagId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });
  if (!customer) return { success: false, error: "Client introuvable" };

  const tag = await prisma.customerTag.findFirst({
    where: { id: tagId, organizationId: user.organizationId },
  });
  if (!tag) return { success: false, error: "Tag introuvable" };

  await prisma.customerTagAssignment.upsert({
    where: { customerId_tagId: { customerId, tagId } },
    update: {},
    create: {
      organizationId: user.organizationId,
      customerId,
      tagId,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_TAG_ASSIGNED",
    entityType: "CustomerTag",
    entityId: tagId,
    entityLabel: `${customer.name} → ${tag.name}`,
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { success: true };
}

export async function removeCustomerTagAction(customerId: string, tagId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const assignment = await prisma.customerTagAssignment.findFirst({
    where: { customerId, tagId, organizationId: user.organizationId },
    include: { tag: true, customer: true },
  });
  if (!assignment) return { success: false, error: "Association introuvable" };

  await prisma.customerTagAssignment.delete({
    where: { customerId_tagId: { customerId, tagId } },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_TAG_REMOVED",
    entityType: "CustomerTag",
    entityId: tagId,
    entityLabel: `${assignment.customer.name} → ${assignment.tag.name}`,
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { success: true };
}

export async function createCustomerTagAction(name: string, color = "#64748b") {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const tag = await prisma.customerTag.upsert({
    where: {
      organizationId_name: {
        organizationId: user.organizationId,
        name,
      },
    },
    update: { color },
    create: {
      organizationId: user.organizationId,
      name,
      color,
    },
  });

  return { success: true, tag };
}
