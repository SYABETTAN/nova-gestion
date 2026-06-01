import type { ExportFormat, ExportType } from "@prisma/client";
import type { PermissionKey } from "@prisma/client";

export type ExportSection =
  | "commercial"
  | "suppliers"
  | "accounting"
  | "pilotage"
  | "documents";

export type ExportDefinition = {
  type: ExportType;
  label: string;
  description: string;
  section: ExportSection;
  formats: ExportFormat[];
  permission: PermissionKey;
  supportsJson?: boolean;
  supportsPeriod?: boolean;
  documentPath?: string;
};

export type ExportResult = {
  content: string;
  fileName: string;
  rowCount: number;
  mimeType: string;
};
