"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
} from "@/lib/validators";
import { absoluteUrl } from "@/lib/email/app-url";
import { buildTeamInvitationEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send-email";
import {
  generateInvitationToken,
  getInvitationExpiryDate,
} from "@/lib/invitation-token";
import { canAssignRole } from "@/lib/role-hierarchy";
import { normalizeInvitationEmail } from "@/lib/invitations";
import type { SystemRole } from "@prisma/client";

export async function getTeamMembersAction() {
  const user = await requireAuth();
  requirePermission(user, "MEMBERS_READ");

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: user.organizationId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      role: { select: { key: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId: user.organizationId,
      status: "PENDING",
    },
    include: { role: { select: { key: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return { members, invitations };
}

export async function inviteMemberAction(formData: FormData) {
  try {
    const user = await requireAuth();
    requirePermission(user, "MEMBERS_INVITE");

    const raw = Object.fromEntries(formData.entries());
    const parsed = inviteMemberSchema.safeParse(raw);

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
    }

    const email = normalizeInvitationEmail(parsed.data.email);
    const roleKey = parsed.data.roleKey as SystemRole;

    if (!canAssignRole(user.roleKey as SystemRole, roleKey)) {
      return {
        success: false,
        error: "Vous ne pouvez pas attribuer ce rôle avec vos permissions actuelles.",
      };
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: user.organizationId,
            userId: existingUser.id,
          },
        },
      });
      if (existingMember) {
        return { success: false, error: "Cet utilisateur est déjà membre" };
      }
    }

    const pendingInvite = await prisma.invitation.findFirst({
      where: {
        organizationId: user.organizationId,
        email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvite) {
      return { success: false, error: "Une invitation est déjà en attente pour cet email." };
    }

    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) {
      return { success: false, error: "Rôle introuvable" };
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true },
    });
    if (!org) {
      return { success: false, error: "Organisation introuvable" };
    }

    const { rawToken, tokenHash } = generateInvitationToken();
    const expiresAt = getInvitationExpiryDate();
    const invitePath = `/accept-invitation/${rawToken}`;
    const inviteUrl = absoluteUrl(invitePath);

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: user.organizationId,
        email,
        roleId: role.id,
        tokenHash,
        status: "PENDING",
        invitedById: user.id,
        expiresAt,
      },
    });

    const template = buildTeamInvitationEmail({
      organizationName: org.name,
      inviterName: user.name,
      inviterEmail: user.email,
      inviteeEmail: email,
      roleName: role.name,
      inviteUrl,
      expiresAt,
    });

    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: [{ name: "type", value: "team-invitation" }, { name: "invitationId", value: invitation.id }],
    });

    if (!emailResult.success) {
      await prisma.invitation.delete({ where: { id: invitation.id } });
      return { success: false, error: emailResult.error };
    }

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "MEMBER_INVITED",
      entityType: "Invitation",
      entityId: invitation.id,
      entityLabel: email,
      newValues: {
        email,
        role: roleKey,
        expiresAt: expiresAt.toISOString(),
        messageId: emailResult.messageId,
        provider: emailResult.provider,
      },
    });

    revalidatePath("/settings/team");

    return {
      success: true,
      invitationLink: invitePath,
      message: "Invitation envoyée par email.",
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("envoi par email")) {
      return { success: false, error: err.message };
    }
    throw err;
  }
}

export async function updateMemberRoleAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "MEMBERS_UPDATE");

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateMemberRoleSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { memberId, roleKey } = parsed.data;

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: user.organizationId },
    include: { role: true, user: true },
  });

  if (!member) {
    return { success: false, error: "Membre introuvable" };
  }

  const newRole = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!newRole) {
    return { success: false, error: "Rôle introuvable" };
  }

  if (member.role.key === "OWNER" && roleKey !== "OWNER") {
    const ownerCount = await prisma.organizationMember.count({
      where: {
        organizationId: user.organizationId,
        status: "ACTIVE",
        role: { key: "OWNER" },
      },
    });
    if (ownerCount <= 1) {
      return { success: false, error: "Impossible de retirer le dernier propriétaire" };
    }
  }

  await prisma.organizationMember.update({
    where: { id: memberId },
    data: { roleId: newRole.id },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEMBER_ROLE_UPDATED",
    entityType: "OrganizationMember",
    entityId: memberId,
    entityLabel: member.user.email,
    oldValues: { role: member.role.key },
    newValues: { role: roleKey },
  });

  revalidatePath("/settings/team");
  return { success: true };
}

export async function updateMemberStatusAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "MEMBERS_SUSPEND");

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateMemberStatusSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { memberId, status } = parsed.data;

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: user.organizationId },
    include: { role: true, user: true },
  });

  if (!member) {
    return { success: false, error: "Membre introuvable" };
  }

  if (member.role.key === "OWNER" && status === "SUSPENDED") {
    const ownerCount = await prisma.organizationMember.count({
      where: {
        organizationId: user.organizationId,
        status: "ACTIVE",
        role: { key: "OWNER" },
      },
    });
    if (ownerCount <= 1) {
      return { success: false, error: "Impossible de suspendre le dernier propriétaire" };
    }
  }

  await prisma.organizationMember.update({
    where: { id: memberId },
    data: { status },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: status === "SUSPENDED" ? "MEMBER_SUSPENDED" : "MEMBER_REACTIVATED",
    entityType: "OrganizationMember",
    entityId: memberId,
    entityLabel: member.user.email,
    oldValues: { status: member.status },
    newValues: { status },
  });

  revalidatePath("/settings/team");
  return { success: true };
}
