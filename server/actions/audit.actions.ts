"use server";

import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getAuditLogs } from "@/lib/audit";
import { auditLogFilterSchema } from "@/lib/validators";

export async function getAuditLogsAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "AUDIT_LOG_READ");

  const parsed = auditLogFilterSchema.safeParse(searchParams);
  if (!parsed.success) {
    return { logs: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  const { action, userId, entityType, dateFrom, dateTo, page, pageSize } = parsed.data;

  return getAuditLogs({
    organizationId: user.organizationId,
    action: action || undefined,
    userId: userId || undefined,
    entityType: entityType || undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
    page,
    pageSize,
  });
}

export async function getAuditLogUsersAction() {
  const user = await requireAuth();
  requirePermission(user, "AUDIT_LOG_READ");

  const { prisma } = await import("@/lib/prisma");

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: user.organizationId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return members.map((m) => m.user);
}
