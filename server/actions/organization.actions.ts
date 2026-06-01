"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { updateOrganizationSchema } from "@/lib/validators";

export async function updateOrganizationAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ORGANIZATION_UPDATE");
  requirePermission(user, "SETTINGS_UPDATE");

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateOrganizationSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const existing = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });

  if (!existing) {
    return { success: false, error: "Organisation introuvable" };
  }

  const data = {
    ...parsed.data,
    email: parsed.data.email || null,
    website: parsed.data.website || null,
    phone: parsed.data.phone || null,
    logoUrl: parsed.data.logoUrl || null,
    siret: parsed.data.siret || null,
    vatNumber: parsed.data.vatNumber || null,
    legalForm: parsed.data.legalForm || null,
    shareCapital: parsed.data.shareCapital || null,
    addressLine1: parsed.data.addressLine1 || null,
    addressLine2: parsed.data.addressLine2 || null,
    postalCode: parsed.data.postalCode || null,
    city: parsed.data.city || null,
    defaultInvoiceFooter: parsed.data.defaultInvoiceFooter || null,
    defaultQuoteFooter: parsed.data.defaultQuoteFooter || null,
  };

  const updated = await prisma.organization.update({
    where: { id: user.organizationId },
    data,
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SETTINGS_UPDATED",
    entityType: "Organization",
    entityId: updated.id,
    entityLabel: updated.name,
    oldValues: {
      name: existing.name,
      legalName: existing.legalName,
      email: existing.email,
      phone: existing.phone,
    },
    newValues: {
      name: updated.name,
      legalName: updated.legalName,
      email: updated.email,
      phone: updated.phone,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ORGANIZATION_UPDATED",
    entityType: "Organization",
    entityId: updated.id,
    entityLabel: updated.name,
  });

  revalidatePath("/settings/company");
  revalidatePath("/dashboard");

  return { success: true };
}
