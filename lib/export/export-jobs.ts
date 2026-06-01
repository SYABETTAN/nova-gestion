import { prisma } from "@/lib/prisma";
import type { ExportFormat, ExportStatus, ExportType } from "@prisma/client";
import { formatExportFileName } from "@/lib/export/export-formatters";

export async function createExportJob(input: {
  organizationId: string;
  type: ExportType;
  format: ExportFormat;
  filters?: Record<string, unknown>;
  requestedById?: string;
}) {
  return prisma.exportJob.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      format: input.format,
      status: "PROCESSING",
      filters: input.filters ? JSON.stringify(input.filters) : null,
      requestedById: input.requestedById,
      startedAt: new Date(),
      fileName: formatExportFileName(input.type, input.format),
    },
  });
}

export async function completeExportJob(
  exportJobId: string,
  result: { rowCount: number; fileName?: string; fileUrl?: string },
) {
  return prisma.exportJob.update({
    where: { id: exportJobId },
    data: {
      status: "COMPLETED" as ExportStatus,
      rowCount: result.rowCount,
      fileName: result.fileName,
      fileUrl: result.fileUrl,
      completedAt: new Date(),
    },
  });
}

export async function failExportJob(exportJobId: string, error: string) {
  return prisma.exportJob.update({
    where: { id: exportJobId },
    data: {
      status: "FAILED",
      errorMessage: error,
      completedAt: new Date(),
    },
  });
}
