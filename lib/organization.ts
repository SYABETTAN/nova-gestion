import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function getCurrentOrganization() {
  const user = await requireAuth();

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });

  if (!organization) {
    throw new Error("Organisation introuvable");
  }

  return { user, organization };
}

/** @deprecated Utiliser getCurrentOrganization */
export const getCurrentDemoOrganization = getCurrentOrganization;

export async function getOrganizationById(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
  });
}
