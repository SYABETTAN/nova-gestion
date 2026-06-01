import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { devLoginEnabled } from "@/lib/env";
import { DEV_PASSWORD, DEV_SAMPLE_USERS } from "@/lib/dev-fixtures";
import { getPermissionsForRole, type SessionUser } from "@/lib/permissions";
import { bootstrapOrganization } from "@/lib/org-bootstrap";
import { assertPublicOrganizationSignupAllowed } from "@/lib/registration";
import { createOrganizationWithOwner } from "@/lib/organization-create";
import {
  createSignedSessionValue,
  getSessionCookieClearOptions,
  getSessionCookieOptions,
  SESSION_COOKIE,
  validateSessionCookie,
} from "@/lib/session";
import type { SystemRole } from "@prisma/client";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function buildSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { role: true, organization: true },
        orderBy: { joinedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    return null;
  }

  const membership = user.memberships[0];
  const roleKey = membership.role.key;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organizationId,
    roleKey,
    permissions: getPermissionsForRole(roleKey),
  };
}

export async function createSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSignedSessionValue(userId), getSessionCookieOptions());
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", getSessionCookieClearOptions());
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const validation = validateSessionCookie(raw);
  if (!validation.valid) {
    if (raw) {
      await destroySession();
    }
    return null;
  }
  return buildSessionUser(validation.userId);
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { success: false, error: "Identifiants invalides" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: "Identifiants invalides" };
  }

  const activeMembership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
  });
  if (!activeMembership) {
    return {
      success: false,
      error: "Compte désactivé ou sans organisation active. Contactez votre administrateur.",
    };
  }

  await createSession(user.id);

  const sessionUser = await buildSessionUser(user.id);
  if (sessionUser) {
    await createAuditLog({
      organizationId: sessionUser.organizationId,
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
      entityLabel: user.email,
    });
  }

  return { success: true };
}

/** Connexion rapide réservée au développement local (ENABLE_DEV_LOGIN=true). */
export async function loginAsDevOwner(): Promise<{ success: boolean; error?: string }> {
  if (!devLoginEnabled()) {
    return { success: false, error: "Connexion développeur désactivée" };
  }
  return loginWithCredentials(DEV_SAMPLE_USERS[0].email, DEV_PASSWORD);
}

export async function logout(): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "USER_LOGOUT",
      entityType: "User",
      entityId: user.id,
      entityLabel: user.email,
    });
  }
  await destroySession();
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const signupCheck = assertPublicOrganizationSignupAllowed();
  if (!signupCheck.allowed) {
    return { success: false, error: signupCheck.error };
  }

  const result = await createOrganizationWithOwner(name, email, password);
  if (!result.success) {
    return result;
  }

  await createSession(result.userId);
  return { success: true };
}

export function getDevLoginAccounts() {
  if (!devLoginEnabled()) return [];
  return DEV_SAMPLE_USERS.map((u) => ({
    ...u,
    password: DEV_PASSWORD,
  }));
}

export type { SessionUser, SystemRole };
