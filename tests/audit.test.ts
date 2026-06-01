import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createAuditLog, getAuditLogs } from "@/lib/audit";

const prisma = new PrismaClient();

describe("audit", () => {
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    const org = await prisma.organization.findUnique({
      where: { slug: "nova-gestion" },
    });
    const user = await prisma.user.findUnique({
      where: { email: "owner@dev.local" },
    });

    if (!org || !user) {
      throw new Error("Seed data required — run npm run db:seed first");
    }

    organizationId = org.id;
    userId = user.id;
  });

  afterAll(async () => {
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
