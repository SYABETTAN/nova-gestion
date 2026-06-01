import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  generateInvitationToken,
  getInvitationExpiryDate,
} from "@/lib/invitation-token";
import { validateInvitationForAcceptance } from "@/lib/invitations";
import { createOrganizationWithOwner } from "@/lib/organization-create";

const prisma = new PrismaClient();
const testOrgIds: string[] = [];

async function loadRegistrationModule() {
  return import("@/lib/registration");
}

describe("inscription production", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();

    for (const orgId of testOrgIds.splice(0)) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    }
  });

  it("bloque l'inscription publique en production par défaut (invite_only)", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "production-secret-key-32-chars-min!!");
    vi.stubEnv("SEED_DEV_DATA", "false");
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");

    const { getRegistrationMode, isPublicOrganizationSignupAllowed } =
      await loadRegistrationModule();

    expect(getRegistrationMode()).toBe("invite_only");
    expect(isPublicOrganizationSignupAllowed()).toBe(false);
  });

  it("refuse registerUser en production via l'action serveur", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "production-secret-key-32-chars-min!!");
    vi.stubEnv("SEED_DEV_DATA", "false");
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");
    vi.stubEnv("REGISTRATION_MODE", "invite_only");

    const { registerUser } = await import("@/lib/auth");
    const result = await registerUser("Test Org", "blocked@test.local", "Password123!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("invitation");
    }
  });

  it("refuse registerAction même si l'UI est contournée", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "production-secret-key-32-chars-min!!");
    vi.stubEnv("SEED_DEV_DATA", "false");
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");
    vi.stubEnv("REGISTRATION_MODE", "closed");

    const { registerAction } = await import("@/server/actions/auth.actions");
    const formData = new FormData();
    formData.set("name", "Hack Org");
    formData.set("email", "hack@test.local");
    formData.set("password", "Password123!");

    const result = await registerAction(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/fermées|invitation/i);
    }
  });

  it("autorise l'inscription en développement (open_dev)", async () => {
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("REGISTRATION_MODE", "open_dev");

    const { isPublicOrganizationSignupAllowed, assertPublicOrganizationSignupAllowed } =
      await loadRegistrationModule();
    expect(isPublicOrganizationSignupAllowed()).toBe(true);
    expect(assertPublicOrganizationSignupAllowed().allowed).toBe(true);
  });

  it("bootstrap une organisation créée via createOrganizationWithOwner", async () => {
    const email = `reg-bootstrap-${Date.now()}@test.local`;

    const result = await createOrganizationWithOwner("Org Bootstrap Test", email, "Password123!");
    expect(result.success).toBe(true);
    if (!result.success) return;

    testOrgIds.push(result.organizationId);

    const org = await prisma.organization.findUnique({
      where: { id: result.organizationId },
    });
    const sequences = await prisma.numberingSequence.count({
      where: { organizationId: result.organizationId },
    });

    expect(org).not.toBeNull();
    expect(sequences).toBeGreaterThan(0);
  });

  it("permet l'onboarding ops même quand l'inscription publique est fermée", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "production-secret-key-32-chars-min!!");
    vi.stubEnv("SEED_DEV_DATA", "false");
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");
    vi.stubEnv("REGISTRATION_MODE", "invite_only");

    const { registerUser } = await import("@/lib/auth");
    const blocked = await registerUser("Blocked Org", `blocked-ops-${Date.now()}@test.local`, "Password123!");
    expect(blocked.success).toBe(false);

    const email = `ops-onboard-${Date.now()}@test.local`;
    const created = await createOrganizationWithOwner("Client Ops", email, "Password123!");
    expect(created.success).toBe(true);
    if (created.success) {
      testOrgIds.push(created.organizationId);
    }
  });

  it("refuse ALLOW_PUBLIC_SIGNUP sans REGISTRATION_MODE=open_dev en production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "production-secret-key-32-chars-min!!");
    vi.stubEnv("SEED_DEV_DATA", "false");
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");
    vi.stubEnv("ALLOW_PUBLIC_SIGNUP", "true");
    vi.stubEnv("REGISTRATION_MODE", "invite_only");

    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/ALLOW_PUBLIC_SIGNUP/);
  });

  it("refuse open_dev en production sans ALLOW_PUBLIC_SIGNUP explicite", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "production-secret-key-32-chars-min!!");
    vi.stubEnv("SEED_DEV_DATA", "false");
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");
    vi.stubEnv("REGISTRATION_MODE", "open_dev");

    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/ALLOW_PUBLIC_SIGNUP/);
  });

  it("n'utilise pas de texte interdit dans les messages d'inscription", async () => {
    const { REGISTRATION_MESSAGES } = await loadRegistrationModule();
    for (const message of Object.values(REGISTRATION_MESSAGES)) {
      const lower = message.toLowerCase();
      expect(lower).not.toContain("demo");
      expect(lower).not.toContain("fake");
      expect(lower).not.toContain("sandbox");
      expect(lower).not.toContain("simulé");
      expect(lower).not.toContain("fictif");
    }
  });

  it("laisse les invitations équipe indépendantes du mode d'inscription", async () => {
    const ownerRole = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER" } });
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
    const slug = `test-reg-invite-${Date.now()}`;
    const ownerEmail = `owner-reg-inv-${Date.now()}@test.local`;

    const org = await prisma.organization.create({
      data: {
        name: "Invite Reg Test",
        legalName: "Invite Reg Test",
        slug,
        email: ownerEmail,
        country: "FR",
      },
    });
    testOrgIds.push(org.id);

    const owner = await prisma.user.create({
      data: {
        name: "Owner",
        email: ownerEmail,
        passwordHash: "hash",
        memberships: {
          create: {
            organizationId: org.id,
            roleId: ownerRole.id,
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        },
      },
    });

    const { rawToken, tokenHash } = generateInvitationToken();
    const invitation = await prisma.invitation.create({
      data: {
        organizationId: org.id,
        email: `member-reg-inv-${Date.now()}@test.local`,
        roleId: adminRole.id,
        tokenHash,
        invitedById: owner.id,
        expiresAt: getInvitationExpiryDate(),
        status: "PENDING",
      },
    });

    const validation = await validateInvitationForAcceptance(rawToken);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.invitation.id).toBe(invitation.id);
    }
  });
});

describe("inscription — mode par défaut dev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("utilise open_dev en développement sans variable explicite", async () => {
    vi.stubEnv("APP_ENV", "development");

    const { getRegistrationMode } = await loadRegistrationModule();
    expect(getRegistrationMode()).toBe("open_dev");
  });
});
