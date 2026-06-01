import { z } from "zod";

const discountTypeSchema = z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional().nullable();
const lineTypeSchema = z.enum(["ITEM", "SERVICE", "FREE_TEXT", "SECTION", "COMMENT"]);

export const quoteLineInputSchema = z
  .object({
    itemId: z.string().optional().nullable(),
    lineType: lineTypeSchema.default("ITEM"),
    position: z.coerce.number().int().min(0),
    reference: z.string().optional().nullable(),
    name: z.string().min(1, "Le libellé est obligatoire"),
    description: z.string().optional().nullable(),
    quantity: z.coerce.number().positive("La quantité doit être supérieure à 0").default(1),
    unit: z.string().default("unité"),
    unitPriceExcludingTax: z.coerce.number().min(0).default(0),
    discountType: discountTypeSchema,
    discountValue: z.coerce.number().min(0).default(0),
    vatRate: z.coerce.number().min(0).max(100).default(20),
  })
  .superRefine((line, ctx) => {
    if (line.lineType === "SECTION" || line.lineType === "COMMENT") return;

    if (line.discountType === "PERCENTAGE" && line.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La remise en pourcentage ne peut pas dépasser 100 %",
        path: ["discountValue"],
      });
    }
  });

export const createQuoteSchema = z
  .object({
    customerId: z.string().min(1, "Le client est obligatoire"),
    customerContactId: z.string().optional().nullable(),
    billingAddressId: z.string().optional().nullable(),
    shippingAddressId: z.string().optional().nullable(),
    title: z.string().min(2, "Le titre doit contenir au moins 2 caractères"),
    subject: z.string().optional().nullable(),
    issueDate: z.coerce.date(),
    validUntil: z.coerce.date(),
    currency: z.string().default("EUR"),
    language: z.string().default("fr-FR"),
    paymentTermsDays: z.coerce.number().int().min(0).max(120).default(30),
    introductionText: z.string().optional().nullable(),
    footerText: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    customerNotes: z.string().optional().nullable(),
    globalDiscountType: discountTypeSchema,
    globalDiscountValue: z.coerce.number().min(0).default(0),
    shippingAmountExcludingTax: z.coerce.number().min(0).default(0),
    otherFeesExcludingTax: z.coerce.number().min(0).default(0),
    lines: z.array(quoteLineInputSchema).min(1, "Au moins une ligne est requise"),
  })
  .superRefine((data, ctx) => {
    if (data.validUntil < data.issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La date de validité doit être postérieure ou égale à la date d'émission",
        path: ["validUntil"],
      });
    }

    const billableLines = data.lines.filter(
      (l) => l.lineType === "ITEM" || l.lineType === "SERVICE" || l.lineType === "FREE_TEXT",
    );

    if (billableLines.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Au moins une ligne facturable est requise",
        path: ["lines"],
      });
    }

    if (data.globalDiscountType === "PERCENTAGE" && data.globalDiscountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La remise globale en pourcentage ne peut pas dépasser 100 %",
        path: ["globalDiscountValue"],
      });
    }
  });

export const updateQuoteSchema = createQuoteSchema;

export const quoteFilterSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  customerId: z.string().optional(),
  issueDateFrom: z.string().optional(),
  issueDateTo: z.string().optional(),
  validUntilFrom: z.string().optional(),
  validUntilTo: z.string().optional(),
  archived: z.enum(["false", "true", "only"]).optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  sortBy: z
    .enum(["createdAt", "issueDate", "validUntil", "totalIncludingTax", "status", "customer"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const sendQuoteSimulationSchema = z.object({
  recipient: z.string().email("Email invalide"),
  subject: z.string().min(1, "L'objet est obligatoire"),
  message: z.string().min(1, "Le message est obligatoire"),
});

export const updateQuoteStatusSchema = z.object({
  quoteId: z.string().min(1),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;
export type QuoteFilterInput = z.infer<typeof quoteFilterSchema>;
export type SendQuoteSimulationInput = z.infer<typeof sendQuoteSimulationSchema>;
