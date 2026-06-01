import { z } from "zod";

const optionalUrl = z
  .string()
  .url("URL invalide")
  .optional()
  .or(z.literal(""))
  .or(z.string().startsWith("/"));

const itemBaseFields = {
  type: z.enum(["PRODUCT", "SERVICE"]).default("SERVICE"),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).default("ACTIVE"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  sku: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  categoryId: z.string().optional().or(z.literal("")),
  unitId: z.string().optional().or(z.literal("")),
  imageUrl: optionalUrl,
  barcode: z.string().optional(),
  defaultVatRate: z.coerce.number().min(0).max(100).default(20),
  salePriceExcludingTax: z.coerce.number().min(0).default(0),
  purchasePriceExcludingTax: z.coerce.number().min(0).default(0),
  currency: z.string().length(3).default("EUR"),
  isRecurring: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean().default(false),
  ),
  recurringInterval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional().or(z.literal("")),
  isStockable: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean().default(false),
  ),
  stockQuantity: z.coerce.number().min(0).default(0),
  stockAlertThreshold: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  tagIds: z.string().optional(),
};

export const createItemSchema = z
  .object(itemBaseFields)
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurringInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Intervalle de récurrence requis",
        path: ["recurringInterval"],
      });
    }
    if (data.type === "SERVICE" && data.isStockable) {
      // allow but warn in UI; no block for sandbox
    }
  });

export const updateItemSchema = createItemSchema;

export const itemFilterSchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  vatRate: z.string().optional(),
  archived: z.enum(["true", "false", "only"]).optional(),
  isRecurring: z.string().optional(),
  isStockable: z.string().optional(),
  sortBy: z
    .enum(["name", "createdAt", "salePriceExcludingTax", "marginRate", "status", "type"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const createItemCategorySchema = z.object({
  name: z.string().min(2, "Nom requis"),
  description: z.string().optional(),
  color: z.string().default("#64748b"),
});

export const createItemTagSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  color: z.string().default("#64748b"),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ItemFilterInput = z.infer<typeof itemFilterSchema>;
