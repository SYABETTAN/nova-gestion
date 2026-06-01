import { z } from "zod";

const accountTypeSchema = z.enum([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
  "TAX",
  "CUSTOMER",
  "SUPPLIER",
  "BANK",
  "OTHER",
]);

const accountCategorySchema = z.enum([
  "CUSTOMER_RECEIVABLE",
  "SUPPLIER_PAYABLE",
  "BANK",
  "CASH",
  "SALES_REVENUE",
  "SERVICE_REVENUE",
  "PURCHASE_EXPENSE",
  "GENERAL_EXPENSE",
  "VAT_COLLECTED",
  "VAT_DEDUCTIBLE",
  "VAT_DUE",
  "DISCOUNT",
  "OTHER",
]);

const journalTypeSchema = z.enum(["SALES", "PURCHASES", "BANK", "CASH", "MISCELLANEOUS"]);

export const createAccountingAccountSchema = z.object({
  accountNumber: z.string().min(3, "Numéro de compte requis"),
  name: z.string().min(2, "Nom requis"),
  type: accountTypeSchema,
  category: accountCategorySchema,
  description: z.string().optional().nullable(),
});

export const updateAccountingAccountSchema = createAccountingAccountSchema.partial();

export const createAccountingJournalSchema = z.object({
  code: z.string().min(2, "Code requis"),
  name: z.string().min(2, "Nom requis"),
  type: journalTypeSchema,
});

export const updateAccountingJournalSchema = createAccountingJournalSchema.partial();

export const accountingEntryLineInputSchema = z
  .object({
    accountId: z.string().min(1, "Compte requis"),
    lineNumber: z.coerce.number().int().min(0),
    label: z.string().min(1, "Libellé requis"),
    debit: z.coerce.number().min(0).default(0),
    credit: z.coerce.number().min(0).default(0),
    currency: z.string().length(3).default("EUR"),
    customerId: z.string().optional().nullable(),
    supplierId: z.string().optional().nullable(),
    invoiceId: z.string().optional().nullable(),
    supplierInvoiceId: z.string().optional().nullable(),
    paymentId: z.string().optional().nullable(),
    taxRate: z.coerce.number().optional().nullable(),
  })
  .refine((l) => !(l.debit > 0 && l.credit > 0), {
    message: "Débit et crédit ne peuvent pas coexister sur une ligne",
  });

export const createAccountingEntrySchema = z.object({
  journalId: z.string().min(1, "Journal requis"),
  entryDate: z.coerce.date(),
  label: z.string().min(2, "Libellé requis"),
  reference: z.string().optional().nullable(),
  lines: z.array(accountingEntryLineInputSchema).min(1, "Au moins une ligne requise"),
});

export const updateAccountingEntrySchema = createAccountingEntrySchema;

export const accountingEntryFilterSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  journalId: z.string().optional(),
  sourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  balanced: z.enum(["true", "false"]).optional(),
  includeDrafts: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["entryDate", "entryNumber", "createdAt", "totalDebit"]).default("entryDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const generalLedgerFilterSchema = z.object({
  accountId: z.string().optional(),
  journalId: z.string().optional(),
  sourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  includeDrafts: z.enum(["true", "false"]).optional(),
});

export const trialBalanceFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountType: z.string().optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
  includeDrafts: z.enum(["true", "false"]).optional(),
});

export const vatSummaryFilterSchema = z.object({
  year: z.coerce.number().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  includeDrafts: z.enum(["true", "false"]).optional(),
});

export const cancelAccountingEntrySchema = z.object({
  reason: z.string().min(3, "La raison doit contenir au moins 3 caractères"),
});

export type CreateAccountingEntryInput = z.infer<typeof createAccountingEntrySchema>;
export type AccountingEntryFilterInput = z.infer<typeof accountingEntryFilterSchema>;
export type GeneralLedgerFilterInput = z.infer<typeof generalLedgerFilterSchema>;
export type TrialBalanceFilterInput = z.infer<typeof trialBalanceFilterSchema>;
export type VatSummaryFilterInput = z.infer<typeof vatSummaryFilterSchema>;
