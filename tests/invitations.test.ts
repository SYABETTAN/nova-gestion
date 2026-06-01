import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  generateInvitationToken,
  getInvitationExpiryDate,
  hashInvitationToken,
} from "@/lib/invitation-token";
import { canAssignRole } from "@/lib/role-hierarchy";
import { validateInvitationForAcceptance } from "@/lib/invitations";
import { buildTeamInvitationEmail } from "@/lib/email/templates";
import { setEmailProviderForTests, resetEmailProviderForTests } from "@/lib/email/send-email";

const prisma = new PrismaClient();
const testOrgSlugs: string[] = [];

async function createOrgWithOwner(suffix: string) {
  const slug = `test-invite-${suffix}-${Date.now()}`;
  testOrgSlugs.push(slug);
  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER" } });
  const email = `owner-${suffix}-${Date.now()}@test.local`;
  const passwordHash = await bcrypt.hash("InviteTest123!", 10);

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: `Invite Org ${suffix}`,
        legalName: `Invite Org ${suffix}`,
        slug,
        email,
        country: "FR",
      },
    });
    const user = await tx.user.create({
      data: {
        name: "Owner Invite",
        email,
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
    return { organization, user, ownerRole };
  });
}

async function createPendingInvitation(params: {
  organizationId: string;
  invitedById: string;
  roleId: string;
  email: string;
  expiresAt?: Date;
  status?: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
}) {
  const { rawToken, tokenHash } = generateInvitationToken();
  const invitation = await prisma.invitation.create({
    data: {
      organizationId: params.organizationId,
      email: params.email,
      roleId: params.roleId,
      tokenHash,
      status: params.status ?? "PENDING",
      invitedById: params.invitedById,
      expiresAt: params.expiresAt ?? getInvitationExpiryDate(),
      acceptedAt: params.status === "ACCEPTED" ? new Date() : null,
    },
    include: {
      organization: { select: { id: true, name: true } },
      role: { select: { id: true, key: true, name: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });
  return { invitation, rawToken };
}

describe("invitations sécurisées", () => {
  beforeAll(async () => {
    await prisma.role.findUniqueOrThrow({ where: { key: "OWNER" } });
  });

  afterEach(async () => {
    resetEmailProviderForTests();
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/permissions");
    vi.doUnmock("next/cache");
    vi.resetModules();
    for (const slug of testOrgSlugs.splice(0)) {
      const org = await prisma.organization.findUnique({ where: { slug } });
      if (org) await prisma.organization.delete({ where: { id: org.id } });
    }
  });

  it("génère un token sécurisé non prédictible", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.rawToken.length).toBeGreaterThanOrEqual(32);
    expect(a.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.tokenHash).not.toContain(a.rawToken);
  });

  it("ne stocke que le hash du token en base", async () => {
    const { organization, user, ownerRole } = await createOrgWithOwner("hash");
    const { invitation, rawToken } = await createPendingInvitation({
      organizationId: organization.id,
      invitedById: user.id,
      roleId: ownerRole.id,
      email: "hash-test@test.local",
    });

    const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(stored.tokenHash).toBe(hashInvitationToken(rawToken));
    expect(stored.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(stored)).not.toContain(rawToken);
  });

  it("refuse une invitation expirée", async () => {
    const { organization, user, ownerRole } = await createOrgWithOwner("expired");
    const salesRole = await prisma.role.findUniqueOrThrow({ where: { key: "SALES" } });
    const { rawToken } = await createPendingInvitation({
      organizationId: organization.id,
      invitedById: user.id,
      roleId: salesRole.id,
      email: "expired@test.local",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const result = await validateInvitationForAcceptance(rawToken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/expiré/i);
  });

  it("refuse une invitation déjà utilisée", async () => {
    const { organization, user, ownerRole } = await createOrgWithOwner("used");
    const salesRole = await prisma.role.findUniqueOrThrow({ where: { key: "SALES" } });
    const { rawToken } = await createPendingInvitation({
      organizationId: organization.id,
      invitedById: user.id,
      roleId: salesRole.id,
      email: "used@test.local",
      status: "ACCEPTED",
    });

    const result = await validateInvitationForAcceptance(rawToken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/déjà été utilisée/i);
  });

  it("accepte une invitation valide et rattache le membre avec le bon rôle", async () => {
    const { organization, user } = await createOrgWithOwner("accept");
    const salesRole = await prisma.role.findUniqueOrThrow({ where: { key: "SALES" } });
    const inviteEmail = `new-sales-${Date.now()}@test.local`;
    const { rawToken } = await createPendingInvitation({
      organizationId: organization.id,
      invitedById: user.id,
      roleId: salesRole.id,
      email: inviteEmail,
    });

    const validation = await validateInvitationForAcceptance(rawToken);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const passwordHash = await bcrypt.hash("NewMember123!", 10);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name: "New Sales", email: inviteEmail, passwordHash },
      });
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          roleId: salesRole.id,
          status: "ACTIVE",
          invitedById: user.id,
          joinedAt: now,
        },
      });
      await tx.invitation.update({
        where: { id: validation.invitation.id },
        data: { status: "ACCEPTED", acceptedAt: now },
      });
    });

    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: organization.id, user: { email: inviteEmail } },
      include: { role: true },
    });
    expect(member?.role.key).toBe("SALES");

    const updatedInvite = await prisma.invitation.findUniqueOrThrow({
      where: { id: validation.invitation.id },
    });
    expect(updatedInvite.status).toBe("ACCEPTED");
    expect(updatedInvite.acceptedAt).not.toBeNull();
  });

  it("empêche un non-OWNER d'inviter un OWNER", () => {
    expect(canAssignRole("ADMIN", "OWNER")).toBe(false);
    expect(canAssignRole("OWNER", "OWNER")).toBe(true);
    expect(canAssignRole("ADMIN", "SALES")).toBe(true);
  });

  it("supprime l'invitation si l'email échoue", async () => {
    const { organization, user } = await createOrgWithOwner("email-fail");
    const { getPermissionsForRole } = await import("@/lib/permissions");

    vi.resetModules();

    vi.doMock("@/lib/email/send-email", () => ({
      sendEmail: vi.fn().mockResolvedValue({ success: false, error: "Échec email" }),
    }));
    vi.doMock("@/lib/auth", () => ({
      requireAuth: vi.fn().mockResolvedValue({
        id: user.id,
        organizationId: organization.id,
        roleKey: "OWNER",
        email: user.email,
        name: user.name,
        permissions: getPermissionsForRole("OWNER"),
      }),
    }));
    vi.doMock("@/lib/permissions", () => ({ requirePermission: vi.fn() }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));

    const beforeCount = await prisma.invitation.count({
      where: { organizationId: organization.id },
    });

    const { inviteMemberAction } = await import("@/server/actions/member.actions");
    const formData = new FormData();
    formData.set("email", `fail-${Date.now()}@test.local`);
    formData.set("roleKey", "SALES");

    const result = await inviteMemberAction(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Échec email");
    }

    const afterCount = await prisma.invitation.count({
      where: { organizationId: organization.id },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it("inclut un lien d'acceptation valide dans l'email sans texte interdit", () => {
    const { rawToken } = generateInvitationToken();
    const inviteUrl = `https://app.example.com/accept-invitation/${rawToken}`;
    const email = buildTeamInvitationEmail({
      organizationName: "Acme SAS",
      inviterName: "Alice",
      inviterEmail: "alice@acme.fr",
      inviteeEmail: "bob@client.fr",
      roleName: "Commercial",
      inviteUrl,
      expiresAt: getInvitationExpiryDate(),
    });

    expect(email.html).toContain(inviteUrl);
    expect(email.text).toContain(inviteUrl);
    for (const word of ["demo", "fake", "sandbox", "simulé", "fictif"]) {
      expect(`${email.subject} ${email.html} ${email.text}`.toLowerCase()).not.toContain(word);
    }
  });

  it("flow accept-invitation : preview valide puis refus après acceptation", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/auth")>();
      return {
        ...actual,
        getSessionUser: vi.fn().mockResolvedValue(null),
      };
    });

    const { organization, user } = await createOrgWithOwner("flow");
    const readRole = await prisma.role.findUniqueOrThrow({ where: { key: "READ_ONLY" } });
    const inviteEmail = `flow-${Date.now()}@test.local`;
    const { rawToken } = await createPendingInvitation({
      organizationId: organization.id,
      invitedById: user.id,
      roleId: readRole.id,
      email: inviteEmail,
    });

    const { getInvitationPreviewAction } = await import("@/server/actions/invitation.actions");
    const preview = await getInvitationPreviewAction(rawToken);
    expect(preview.valid).toBe(true);
    if (preview.valid) {
      expect(preview.organizationName).toBe(organization.name);
      expect(preview.roleKey).toBe("READ_ONLY");
    }

    const inv = await prisma.invitation.findFirstOrThrow({
      where: { email: inviteEmail, organizationId: organization.id },
    });
    await prisma.invitation.update({
      where: { id: inv.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    const second = await getInvitationPreviewAction(rawToken);
    expect(second.valid).toBe(false);
  });
});
