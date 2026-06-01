"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createCustomerNoteSchema } from "@/lib/customer-validators";

export async function createCustomerNoteAction(customerId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });
  if (!customer) return { success: false, error: "Client introuvable" };

  const parsed = createCustomerNoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const note = await prisma.customerNote.create({
    data: {
      organizationId: user.organizationId,
      customerId,
      userId: user.id,
      content: parsed.data.content,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_NOTE_CREATED",
    entityType: "CustomerNote",
    entityId: note.id,
    entityLabel: customer.name,
  });

  revalidatePath(`/customers/${customerId}`);
  return { success: true };
}

export async function deleteCustomerNoteAction(noteId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const existing = await prisma.customerNote.findFirst({
    where: { id: noteId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Note introuvable" };

  await prisma.customerNote.delete({ where: { id: noteId } });

  revalidatePath(`/customers/${existing.customerId}`);
  return { success: true };
}
