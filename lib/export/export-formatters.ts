import type { ExportFormat, ExportType } from "@prisma/client";

export function formatExportFileName(
  type: ExportType,
  format: ExportFormat,
  date = new Date(),
): string {
  const datePart = date.toISOString().slice(0, 10);
  const slug = type.toLowerCase().replace(/_/g, "-");
  const ext = format === "JSON" ? "json" : "csv";
  return `export-${slug}-${datePart}.${ext}`;
}
