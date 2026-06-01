import { z } from "zod";

const supplierInvoiceTypeSchema = z.enum(["STANDARD", "CREDIT_NOTE", "DEPOSIT", "OTHER"]);
const paymentMethodSchema = z
  .enum(["BANK_TRANSFER", "CARD", "CHECK", "CASH", "DIRECT_DEBIT", "OTHER"])
  .optional()
  .nullable();
const attachmentTypeSchema = z.enum(["INVOICE_PDF", "RECEIPT", "CONTRACT", "OTHER"]);

export const supplierInvoiceLineInputSchema = z.object({
  expenseCategoryId: z.string().optional().nullable(),
  position: z.coerce.number().int().min(0),
  reference: z.string().optional().nullable(),
  name: z.string().min(1, "Le libellé est obligatoire"),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().positive("La quantité doit être supérieure à 0"),
  unit: z.string().default("unité"),
  unitPriceExcludingTax: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(20),
});

const supplierInvoiceBaseSchema = z.object({
  supplierId: z.string().min(1, "Le fournisseur est obligatoire"),
  supplierReference: z.string().optional().nullable(),
  type: supplierInvoiceTypeSchema.default("STANDARD"),
  title: z.string().min(2, "Le titre doit contenir au moins 2 caractères"),
  description: z.string().optional().nullable(),
  issueDate: z.coerce.date(),
  receivedDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  currency: z.string().length(3).default("EUR"),
  paymentTermsDays: z.coerce.number().int().min(0).max(120).default(30),
  defaultVatRate: z.coerce.number().min(0).max(100).default(20),
  expenseCategoryId: z.string().optional().nullable(),
  paymentMethodPlaceholder: paymentMethodSchema,
  internalNotes: z.string().optional().nullable(),
  lines: z.array(supplierInvoiceLineInputSchema).min(1, "Au moins une ligne est requise"),
});

function validateDates(data: { issueDate: Date; dueDate: Date }, ctx: z.RefinementCtx) {
  if (data.dueDate < data.issueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La date d'échéance doit être postérieure ou égale à la date de facture",
      path: ["dueDate"],
    });
  }
}

export const createSupplierInvoiceSchema = supplierInvoiceBaseSchema.superRefine(validateDates);

export const updateSupplierInvoiceSchema = supplierInvoiceBaseSchema.superRefine(validateDates);

export const supplierInvoiceFilterSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  supplierId: z.string().optional(),
  expenseCategoryId: z.string().optional(),
  type: z.string().optional(),
  issueDateFrom: z.string().optional(),
  issueDateTo: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  overdue: z.enum(["true", "false"]).optional(),
  archived: z.enum(["true", "false", "only"]).optional(),
  sortBy: z
    .enum(["issueDate", "receivedDate", "dueDate", "totalIncludingTax", "amountDue", "createdAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const cancelSupplierInvoiceSchema = z.object({
  reason: z.string().min(3, "La raison doit contenir au moins 3 caractères"),
});

export const markSupplierInvoicePartiallyPaidSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
});

export const createExpenseCategorySchema = z.object({
  name: z.string().min(2, "Nom requis"),
  description: z.string().optional(),
  color: z.string().optional(),
  defaultVatRate: z.coerce.number().min(0).max(100).default(20),
  accountingAccountPlaceholder: z.string().optional(),
});

export type SupplierInvoiceLineInput = z.infer<typeof supplierInvoiceLineInputSchema>;
export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>;
export type SupplierInvoiceFilterInput = z.infer<typeof supplierInvoiceFilterSchema>;
