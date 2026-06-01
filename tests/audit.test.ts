import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createAuditLog, getAuditLogs } from "@/lib/audit";
import { createOrganizationWithOwner } from "@/lib/organization-create";

const prisma = new PrismaClient();

describe("audit", () => {
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    const ownerRole = await prisma.role.findUnique({ where: { key: "OWNER" } });
    if (!ownerRole) {
      throw new Error("Roles non seedés — exécutez npm run db:seed:production");
    }

    const email = `audit-${Date.now()}@test.local`;
    const result = await createOrganizationWithOwner(`Audit Org ${Date.now()}`, email, "AuditTest123!");
    if (!result.success) {
      throw new Error(result.error);
    }

    organizationId = result.organizationId;
    userId = result.userId;
  });

  afterAll(async () => {
    if (organizationId) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("createAuditLog crée une entrée correcte", async () => {
    const log = await createAuditLog({
      organizationId,
      userId,
      action: "SETTINGS_UPDATED",
      entityType: "Organization",
      entityLabel: "Test audit",
      newValues: { test: true },
    });

    expect(log.id).toBeTruthy();
    expect(log.action).toBe("SETTINGS_UPDATED");
    expect(log.entityLabel).toBe("Test audit");
  });

  it("les logs peuvent être filtrés par action", async () => {
    await createAuditLog({
      organizationId,
      userId,
      action: "USER_LOGIN",
      entityType: "User",
      entityLabel: "filter-test-login",
    });

    const result = await getAuditLogs({
      organizationId,
      action: "USER_LOGIN",
      pageSize: 100,
    });

    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.every((l) => l.action === "USER_LOGIN")).toBe(true);
  });

  it("les logs peuvent être filtrés par utilisateur", async () => {
    const result = await getAuditLogs({
      organizationId,
      userId,
      pageSize: 100,
    });

    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.every((l) => l.userId === userId)).toBe(true);
  });
});
