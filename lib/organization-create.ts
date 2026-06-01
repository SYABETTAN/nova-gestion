import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { bootstrapOrganization } from "@/lib/org-bootstrap";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function uniqueOrgSlug(base: string): Promise<string> {
  let slug = slugify(base) || "organisation";
  let attempt = 0;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${slugify(base)}-${attempt}`;
  }
  return slug;
}

export type CreateOrganizationWithOwnerResult =
  | { success: true; userId: string; organizationId: string; organizationName: string }
  | { success: false; error: string };

/**
 * Crée une organisation, un utilisateur OWNER et exécute le bootstrap.
 * Utilisé par l'inscription publique (si autorisée) et par le script ops `org:create`.
 */
export async function createOrganizationWithOwner(
  name: string,
  email: string,
  password: string,
): Promise<CreateOrganizationWithOwnerResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { success: false, error: "Cet email est déjà utilisé" };
  }

  const ownerRole = await prisma.role.findUnique({ where: { key: "OWNER" } });
  if (!ownerRole) {
    return {
      success: false,
      error: "Configuration incomplète : exécutez le seed des rôles (npm run db:seed)",
    };
  }

  const slug = await uniqueOrgSlug(name);
  const passwordHash = await bcrypt.hash(password, 10);

  const { user, organizationId } = await prisma.$transaction(
    async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          legalName: name,
          slug,
          email: normalizedEmail,
          country: "FR",
        },
      });

      const created = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          memberships: {
            create: {
              organizationId: organization.id,
              roleId: ownerRole.id,
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          },
        },
      });

      await bootstrapOrganization(tx, organization.id);

      return { user: created, organizationId: organization.id };
    },
    { maxWait: 60_000, timeout: 120_000 },
  );

  await createAuditLog({
    organizationId,
    userId: user.id,
    action: "ORGANIZATION_CREATED",
    entityType: "Organization",
    entityLabel: name,
  });

  return {
    success: true,
    userId: user.id,
    organizationId,
    organizationName: name,
  };
}
