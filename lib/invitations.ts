import type { Invitation, InvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashInvitationToken } from "@/lib/invitation-token";

export type InvitationWithRelations = Invitation & {
  organization: { id: string; name: string };
  role: { id: string; key: string; name: string };
  invitedBy: { id: string; name: string; email: string };
};

export type InvitationValidationResult =
  | { ok: true; invitation: InvitationWithRelations }
  | { ok: false; error: string; status?: InvitationStatus };

export async function findInvitationByRawToken(
  rawToken: string,
): Promise<InvitationWithRelations | null> {
  if (!rawToken?.trim()) return null;

  const tokenHash = hashInvitationToken(rawToken.trim());
  return prisma.invitation.findUnique({
    where: { tokenHash },
    include: {
      organization: { select: { id: true, name: true } },
      role: { select: { id: true, key: true, name: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function validateInvitationForAcceptance(
  rawToken: string,
): Promise<InvitationValidationResult> {
  const invitation = await findInvitationByRawToken(rawToken);
  if (!invitation) {
    return { ok: false, error: "Invitation invalide ou introuvable." };
  }

  if (invitation.status === "ACCEPTED") {
    return { ok: false, error: "Cette invitation a déjà été utilisée.", status: "ACCEPTED" };
  }

  if (invitation.status === "REVOKED") {
    return { ok: false, error: "Cette invitation a été révoquée.", status: "REVOKED" };
  }

  if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
    if (invitation.status === "PENDING") {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
    }
    return { ok: false, error: "Cette invitation a expiré.", status: "EXPIRED" };
  }

  if (invitation.status !== "PENDING") {
    return { ok: false, error: "Cette invitation n'est plus valide.", status: invitation.status };
  }

  const orgExists = await prisma.organization.findUnique({
    where: { id: invitation.organizationId },
    select: { id: true },
  });
  if (!orgExists) {
    return { ok: false, error: "L'organisation associée n'existe plus." };
  }

  return { ok: true, invitation };
}

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}
