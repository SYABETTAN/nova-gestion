import { z } from "zod";

const discountTypeSchema = z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional().nullable();
const lineTypeSchema = z.enum(["ITEM", "SERVICE", "FREE_TEXT", "SECTION", "COMMENT"]);
const invoiceTypeSchema = z.enum(["STANDARD", "DEPOSIT", "FINAL", "CREDITED_REFERENCE"]);

export const invoiceLineInputSchema = z
  .object({
    itemId: z.string().optional().nullable(),
    quoteLineId: z.string().optional().nullable(),
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

export const createInvoiceSchema = z
  .object({
    customerId: z.string().min(1, "Le client est obligatoire"),
    customerContactId: z.string().optional().nullable(),
    billingAddressId: z.string().optional().nullable(),
    shippingAddressId: z.string().optional().nullable(),
    type: invoiceTypeSchema.default("STANDARD"),
    title: z.string().min(2, "Le titre doit contenir au moins 2 caractères"),
    subject: z.string().optional().nullable(),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
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
    amountPaid: z.coerce.number().min(0).default(0),
    lines: z.array(invoiceLineInputSchema).min(1, "Au moins une ligne est requise"),
  })
  .superRefine((data, ctx) => {
    if (data.dueDate < data.issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La date d'échéance doit être postérieure ou égale à la date d'émission",
        path: ["dueDate"],
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

export const updateInvoiceSchema = createInvoiceSchema;

export const invoiceFilterSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  type: z.string().optional(),
  customerId: z.string().optional(),
  issueDateFrom: z.string().optional(),
  issueDateTo: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  archived: z.enum(["false", "true", "only"]).optional(),
  overdue: z.enum(["true"]).optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  sortBy: z
    .enum(["createdAt", "issueDate", "dueDate", "totalIncludingTax", "amountDue", "status", "customer"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const sendInvoiceSimulationSchema = z.object({
  recipient: z.string().email("Email invalide"),
  subject: z.string().min(1, "L'objet est obligatoire"),
  message: z.string().min(1, "Le message est obligatoire"),
});

export const createInvoiceFromQuoteSchema = z.object({
  quoteId: z.string().min(1),
});

export const createCreditNoteSchema = z
  .object({
    invoiceId: z.string().min(1),
    reason: z.string().min(2, "La raison est obligatoire"),
    type: z.enum(["TOTAL", "PARTIAL"]),
    partialAmount: z.coerce.number().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PARTIAL" && (!data.partialAmount || data.partialAmount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le montant partiel doit être supérieur à 0",
        path: ["partialAmount"],
      });
    }
  });

export const markInvoicePartiallyPaidSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;
export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
