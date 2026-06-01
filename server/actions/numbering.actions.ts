"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { updateNumberingSequenceSchema } from "@/lib/validators";

export async function getNumberingSequencesAction() {
  const user = await requireAuth();
  requirePermission(user, "NUMBERING_READ");

  return prisma.numberingSequence.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { type: "asc" },
  });
}

export async function updateNumberingSequenceAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "NUMBERING_UPDATE");

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateNumberingSequenceSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { id, prefix, nextNumber, padding, suffix, resetPeriod } = parsed.data;

  const existing = await prisma.numberingSequence.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!existing) {
    return { success: false, error: "Séquence introuvable" };
  }

  const updated = await prisma.numberingSequence.update({
    where: { id },
    data: { prefix, nextNumber, padding, suffix, resetPeriod },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "NUMBERING_UPDATED",
    entityType: "NumberingSequence",
    entityId: updated.id,
    entityLabel: updated.type,
    oldValues: {
      prefix: existing.prefix,
      nextNumber: existing.nextNumber,
      padding: existing.padding,
      suffix: existing.suffix,
      resetPeriod: existing.resetPeriod,
    },
    newValues: {
      prefix: updated.prefix,
      nextNumber: updated.nextNumber,
      padding: updated.padding,
      suffix: updated.suffix,
      resetPeriod: updated.resetPeriod,
    },
  });

  revalidatePath("/settings/numbering");
  return { success: true };
}

export async function generateNumberAction(type: string) {
  const user = await requireAuth();
  requirePermission(user, "NUMBERING_UPDATE");

  const { generateNextNumber } = await import("@/lib/numbering");
  const number = await generateNextNumber(
    user.organizationId,
    type as Parameters<typeof generateNextNumber>[1],
    user.id,
  );

  revalidatePath("/settings/numbering");
  return { success: true, number };
}
