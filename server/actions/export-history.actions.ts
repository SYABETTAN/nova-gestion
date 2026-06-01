"use server";

import { requireAuth } from "@/lib/auth";
import { exportFilterSchema } from "@/lib/export-validators";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import type { ExportStatus, ExportType } from "@prisma/client";

export async function listExportJobsAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "EXPORTS_READ");

  const parsed = exportFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  const where: {
    organizationId: string;
    type?: ExportType;
    status?: ExportStatus;
    format?: "CSV" | "JSON";
    createdAt?: { gte?: Date; lte?: Date };
  } = { organizationId: user.organizationId };

  if (filters.type) where.type = filters.type as ExportType;
  if (filters.status) where.status = filters.status as ExportStatus;
  if (filters.format) where.format = filters.format as "CSV" | "JSON";
  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }

  const [jobs, total] = await Promise.all([
    prisma.exportJob.findMany({
      where,
      include: { requestedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.exportJob.count({ where }),
  ]);

  return {
    jobs,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getExportJobByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "EXPORTS_READ");

  const job = await prisma.exportJob.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { requestedBy: { select: { name: true, email: true } } },
  });

  if (!job) throw new Error("Export introuvable");
  return job;
}

export async function retryExportJobAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "EXPORTS_CREATE");

  const job = await getExportJobByIdAction(id);
  const filters = job.filters ? JSON.parse(job.filters) : {};
  const { requestExportAction } = await import("@/server/actions/export.actions");
  return requestExportAction({
    type: job.type,
    format: job.format,
    ...filters,
  });
}
