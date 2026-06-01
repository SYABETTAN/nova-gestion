"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createSupplierNoteSchema } from "@/lib/supplier-validators";

export async function createSupplierNoteAction(supplierId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: user.organizationId },
  });
  if (!supplier) return { success: false, error: "Fournisseur introuvable" };

  const parsed = createSupplierNoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const note = await prisma.supplierNote.create({
    data: {
      organizationId: user.organizationId,
      supplierId,
      userId: user.id,
      content: parsed.data.content,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_NOTE_CREATED",
    entityType: "SupplierNote",
    entityId: note.id,
    entityLabel: supplier.name,
  });

  revalidatePath(`/suppliers/${supplierId}`);
  return { success: true };
}
