"use server";

import type { ExportFormat, ExportType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getExportDefinition, listAvailableExports } from "@/lib/export/export-registry";
import { createExportJob, completeExportJob, failExportJob } from "@/lib/export/export-jobs";
import { generateExportContent, estimateExportRowCount } from "@/lib/export/generate-export";
import { exportRequestSchema } from "@/lib/export-validators";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions";

export async function listAvailableExportsAction() {
  const user = await requireAuth();
  requirePermission(user, "EXPORTS_READ");

  const definitions = listAvailableExports().filter((d) => hasPermission(user, d.permission));

  const withCounts = await Promise.all(
    definitions.map(async (def) => {
      const lastJob = await prisma.exportJob.findFirst({
        where: { organizationId: user.organizationId, type: def.type, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
      });
      const estimatedRows = await estimateExportRowCount(user.organizationId, def.type);
      return {
        ...def,
        estimatedRows,
        lastCompletedAt: lastJob?.completedAt ?? null,
      };
    }),
  );

  return { exports: withCounts };
}

export async function requestExportAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "EXPORTS_CREATE");

  const parsed = exportRequestSchema.parse(input);
  const type = parsed.type as ExportType;
  const format = parsed.format as ExportFormat;
  const def = getExportDefinition(type);

  if (!hasPermission(user, def.permission)) {
    throw new Error(`Permission refusée pour l'export ${type}`);
  }
  if (format === "JSON" && !def.supportsJson) {
    throw new Error("Export JSON non disponible pour ce type");
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: user.organizationId },
  });

  const filters = {
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    includeArchived: parsed.includeArchived,
  };

  const job = await createExportJob({
    organizationId: user.organizationId,
    type,
    format,
    filters,
    requestedById: user.id,
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "EXPORT_CREATED",
    entityType: "ExportJob",
    entityId: job.id,
    entityLabel: `${def.label} (${format})`,
  });

  try {
    const result = await generateExportContent(
      user.organizationId,
      organization.name,
      type,
      format,
      filters,
    );

    await completeExportJob(job.id, {
      rowCount: result.rowCount,
      fileName: result.fileName,
      fileUrl: undefined,
    });

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "EXPORT_COMPLETED",
      entityType: "ExportJob",
      entityId: job.id,
      entityLabel: `${result.rowCount} lignes — ${result.fileName}`,
    });

    return {
      success: true as const,
      content: result.content,
      fileName: result.fileName,
      mimeType: result.mimeType,
      rowCount: result.rowCount,
      exportJobId: job.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur export";
    await failExportJob(job.id, message);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "EXPORT_FAILED",
      entityType: "ExportJob",
      entityId: job.id,
      entityLabel: message,
    });
    return { success: false as const, error: message };
  }
}
