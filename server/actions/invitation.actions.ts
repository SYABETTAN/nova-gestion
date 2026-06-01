"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  createSession,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  normalizeInvitationEmail,
  validateInvitationForAcceptance,
} from "@/lib/invitations";
import { acceptInvitationSchema } from "@/lib/validators";

export type InvitationPreviewResult =
  | {
      valid: true;
      email: string;
      organizationName: string;
      roleName: string;
      roleKey: string;
      inviterName: string;
      expiresAt: string;
      requiresPassword: boolean;
      requiresName: boolean;
      loggedIn: boolean;
      emailMatchesSession: boolean;
      sessionEmail: string | null;
    }
  | { valid: false; error: string };

export async function getInvitationPreviewAction(
  rawToken: string,
): Promise<InvitationPreviewResult> {
  const validation = await validateInvitationForAcceptance(rawToken);
  if (!validation.ok) {
    return { valid: false, error: validation.error };
  }

  const { invitation } = validation;
  const email = normalizeInvitationEmail(invitation.email);
  const sessionUser = await getSessionUser();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  const loggedIn = Boolean(sessionUser);
  const emailMatchesSession = sessionUser?.email.toLowerCase() === email;

  if (loggedIn && !emailMatchesSession) {
    return {
      valid: false,
      error: `Cette invitation est destinée à ${email}. Déconnectez-vous pour utiliser le bon compte.`,
    };
  }

  return {
    valid: true,
    email,
    organizationName: invitation.organization.name,
    roleName: invitation.role.name,
    roleKey: invitation.role.key,
    inviterName: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt.toISOString(),
    requiresPassword: !loggedIn,
    requiresName: !existingUser,
    loggedIn,
    emailMatchesSession,
    sessionEmail: sessionUser?.email ?? null,
  };
}

export async function acceptInvitationAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = acceptInvitationSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { token, name, password } = parsed.data;
  const validation = await validateInvitationForAcceptance(token);
  if (!validation.ok) {
    return { success: false as const, error: validation.error };
  }

  const invitation = validation.invitation;
  const inviteEmail = normalizeInvitationEmail(invitation.email);
  const sessionUser = await getSessionUser();

  if (sessionUser && sessionUser.email.toLowerCase() !== inviteEmail) {
    return {
      success: false as const,
      error: `Cette invitation est destinée à ${inviteEmail}.`,
    };
  }

  const existingMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: invitation.organizationId,
      user: { email: inviteEmail },
    },
  });
  if (existingMember) {
    return { success: false as const, error: "Cet utilisateur est déjà membre de l'organisation." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: inviteEmail } });

  if (existingUser) {
    if (!sessionUser) {
      if (!password) {
        return { success: false as const, error: "Mot de passe requis pour confirmer votre identité." };
      }
      const valid = await verifyPassword(password, existingUser.passwordHash);
      if (!valid) {
        return { success: false as const, error: "Mot de passe incorrect." };
      }
    }
  } else {
    if (!name?.trim()) {
      return { success: false as const, error: "Nom requis pour créer votre compte." };
    }
    if (!password) {
      return { success: false as const, error: "Mot de passe requis (minimum 8 caractères)." };
    }
  }

  const now = new Date();

  try {
    const userId = await prisma.$transaction(async (tx) => {
      let resolvedUserId: string;

      if (existingUser) {
        resolvedUserId = existingUser.id;
      } else {
        const created = await tx.user.create({
          data: {
            name: name!.trim(),
            email: inviteEmail,
            passwordHash: await hashPassword(password!),
          },
        });
        resolvedUserId = created.id;
      }

      const pendingInvite = await tx.invitation.findUnique({
        where: { id: invitation.id },
      });
      if (!pendingInvite || pendingInvite.status !== "PENDING") {
        throw new Error("INVITATION_ALREADY_USED");
      }
      if (pendingInvite.expiresAt < now) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        throw new Error("INVITATION_EXPIRED");
      }

      await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: resolvedUserId,
          roleId: invitation.roleId,
          status: "ACTIVE",
          invitedById: invitation.invitedById,
          joinedAt: now,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: now },
      });

      return resolvedUserId;
    });

    await createAuditLog({
      organizationId: invitation.organizationId,
      userId,
      action: "MEMBER_INVITATION_ACCEPTED",
      entityType: "Invitation",
      entityId: invitation.id,
      entityLabel: inviteEmail,
      newValues: { role: invitation.role.key },
    });

    await createSession(userId);
    redirect("/dashboard");
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INVITATION_ALREADY_USED") {
        return { success: false as const, error: "Cette invitation a déjà été utilisée." };
      }
      if (err.message === "INVITATION_EXPIRED") {
        return { success: false as const, error: "Cette invitation a expiré." };
      }
    }
    throw err;
  }
}

export async function revokeInvitationAction(invitationId: string) {
  const user = await requireAuth();
  requirePermission(user, "MEMBERS_INVITE");

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId: user.organizationId },
  });

  if (!invitation) {
    return { success: false as const, error: "Invitation introuvable" };
  }

  if (invitation.status !== "PENDING") {
    return { success: false as const, error: "Seules les invitations en attente peuvent être révoquées." };
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEMBER_INVITATION_REVOKED",
    entityType: "Invitation",
    entityId: invitationId,
    entityLabel: invitation.email,
  });

  revalidatePath("/settings/team");
  return { success: true as const };
}
