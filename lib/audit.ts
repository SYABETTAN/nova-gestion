import { AuditAction } from "@prisma/client";
import { hasFilterValue } from "@/lib/filter-params";
import { prisma } from "@/lib/prisma";

export type CreateAuditLogInput = {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel ?? null,
      oldValues: input.oldValues ? JSON.stringify(input.oldValues) : null,
      newValues: input.newValues ? JSON.stringify(input.newValues) : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export type AuditLogFilters = {
  organizationId: string;
  action?: string;
  userId?: string;
  entityType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
};

export async function getAuditLogs(filters: AuditLogFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where = {
    organizationId: filters.organizationId,
    ...(hasFilterValue(filters.action) && filters.action !== "all"
      ? { action: filters.action as AuditAction }
      : {}),
    ...(hasFilterValue(filters.userId) && filters.userId !== "all"
      ? { userId: filters.userId }
      : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      oldValues: log.oldValues ? JSON.parse(log.oldValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function parseAuditLogFilters(filters: AuditLogFilters) {
  return filters;
}
