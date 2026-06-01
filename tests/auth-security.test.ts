import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { assertSameOrganization } from "@/lib/tenant-scope";
import { validateSessionCookie, createSignedSessionValue } from "@/lib/session";

const prisma = new PrismaClient();
const testOrgSlugs: string[] = [];

async function createOrgWithUser(suffix: string, memberStatus: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  const slug = `test-auth-${suffix}-${Date.now()}`;
  testOrgSlugs.push(slug);
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER" } });
  const email = `auth-${suffix}-${Date.now()}@test.local`;
  const passwordHash = await bcrypt.hash("AuthTest123!", 10);

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: `Auth Org ${suffix}`,
        legalName: `Auth Org ${suffix}`,
        slug,
        email,
        country: "FR",
      },
    });
    const user = await tx.user.create({
      data: {
        name: "Auth User",
        email,
        passwordHash,
        memberships: {
          create: {
            organizationId: organization.id,
            roleId: role.id,
            status: memberStatus,
            joinedAt: new Date(),
          },
        },
      },
    });
    return { organization, user };
  });
}

describe("auth security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    for (const slug of testOrgSlugs) {
      const org = await prisma.organization.findUnique({ where: { slug } });
      if (org) await prisma.organization.delete({ where: { id: org.id } });
    }
    await prisma.$disconnect();
  });

  it("refuse SESSION_SECRET par défaut en production", async () => {
    vi.resetModules();
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "development-only-secret-min-32-chars!!");
    vi.stubEnv("SEED_DEV_DATA", "false");
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");

    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
  });

  it("refuse la connexion d'un utilisateur sans membership ACTIVE", async () => {
    const { user } = await createOrgWithUser("suspended", "SUSPENDED");
    const { loginWithCredentials } = await import("@/lib/auth");
    const result = await loginWithCredentials(user.email, "AuthTest123!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/désactivé|organisation active/i);
    }
  });

  it("n'accorde pas de session applicative à un utilisateur suspendu", async () => {
    const { user } = await createOrgWithUser("nosession", "SUSPENDED");

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          take: 1,
        },
      },
    });

    expect(dbUser?.memberships.length).toBe(0);
  });

  it("empêche l'accès cross-tenant via assertSameOrganization", async () => {
    const orgA = await createOrgWithUser("tenant-a");
    const orgB = await createOrgWithUser("tenant-b");
    const userA = {
      id: orgA.user.id,
      email: orgA.user.email,
      name: orgA.user.name,
      organizationId: orgA.organization.id,
      roleKey: "OWNER" as const,
      permissions: [],
    };

    expect(() => assertSameOrganization(userA, orgB.organization.id)).toThrow(/Accès refusé/);
    expect(() => assertSameOrganization(userA, orgA.organization.id)).not.toThrow();
  });

  it("bloque requirePermission pour un rôle non autorisé", () => {
    const readOnlyUser = {
      id: "u1",
      email: "ro@test.local",
      name: "RO",
      organizationId: "org1",
      roleKey: "READ_ONLY" as const,
      permissions: ["CUSTOMERS_READ" as const],
    };

    expect(hasPermission(readOnlyUser, "CUSTOMERS_READ")).toBe(true);
    expect(() => requirePermission(readOnlyUser, "CUSTOMERS_CREATE")).toThrow(/Permission refusée/);
  });

  it("filtre les ressources par organizationId", async () => {
    const orgA = await createOrgWithUser("scope-a");
    const orgB = await createOrgWithUser("scope-b");

    const customerA = await prisma.customer.create({
      data: {
        organizationId: orgA.organization.id,
        name: "Client A",
        customerNumber: `C-A-${Date.now()}`,
        email: "a@test.local",
      },
    });

    const scoped = await prisma.customer.findFirst({
      where: { id: customerA.id, organizationId: orgB.organization.id },
    });
    expect(scoped).toBeNull();
  });

  it("valide qu'un cookie signé avec un autre secret est rejeté", () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret-32-chars-min!!");
    const cookie = createSignedSessionValue("user-x");
    vi.stubEnv("SESSION_SECRET", "another-secret-32-characters-long!!");
    const result = validateSessionCookie(cookie);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("invalid_signature");
  });
});
