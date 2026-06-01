import { z } from "zod";

export const exportRequestSchema = z
  .object({
    type: z.string(),
    format: z.enum(["CSV", "JSON"]).default("CSV"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    includeArchived: z.coerce.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La date de fin doit être postérieure ou égale à la date de début",
        path: ["endDate"],
      });
    }
  });

export const exportFilterSchema = z.object({
  type: z.string().optional(),
  format: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export const documentFilterSchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(20),
});

export const createDocumentSchema = z.object({
  type: z.string(),
  title: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  description: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  sizeBytes: z.coerce.number().min(0).optional(),
});

export const createDocumentTemplateSchema = z.object({
  type: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  primaryColor: z.string().optional(),
  showLogo: z.coerce.boolean().default(true),
  showSandboxBadge: z.coerce.boolean().default(false),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

export const updateDocumentTemplateSchema = createDocumentTemplateSchema.partial();
