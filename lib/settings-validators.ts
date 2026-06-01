import { z } from "zod";

export const createTaxRateSchema = z.object({
  name: z.string().min(1),
  rate: z.coerce.number().min(0).max(100),
  type: z.enum(["VAT", "EXEMPT", "REVERSE_CHARGE", "OTHER"]).default("VAT"),
  country: z.string().min(2).default("FR"),
  description: z.string().optional(),
  accountingCollectedAccountId: z.string().optional(),
  accountingDeductibleAccountId: z.string().optional(),
});

export const updateTaxRateSchema = createTaxRateSchema.partial();

export const createPaymentTermSchema = z.object({
  name: z.string().min(1),
  days: z.coerce.number().int().min(0).max(120),
  description: z.string().optional(),
});

export const updatePaymentTermSchema = createPaymentTermSchema.partial();

export const createCurrencySchema = z.object({
  code: z.string().length(3),
  name: z.string().min(1),
  symbol: z.string().min(1),
  exchangeRateToDefault: z.coerce.number().positive(),
});

export const updateCurrencySchema = createCurrencySchema.partial();

export const updateLocalizationSchema = z.object({
  locale: z.string().min(2),
  timezone: z.string().min(1),
  dateFormat: z.string().min(1),
  numberFormat: z.string().min(1),
  currencyFormat: z.string().min(1),
  firstDayOfWeek: z.string().min(1),
});

export const updateCommercialPreferenceSchema = z.object({
  defaultQuoteValidityDays: z.coerce.number().int().min(1).max(120),
  defaultQuoteIntroduction: z.string().optional(),
  defaultQuoteFooter: z.string().optional(),
  defaultCustomerPaymentTermId: z.string().optional().nullable(),
  defaultCustomerTaxRateId: z.string().optional().nullable(),
  allowQuoteDiscounts: z.coerce.boolean(),
  allowQuoteFreeTextLines: z.coerce.boolean(),
  requireCustomerForQuote: z.coerce.boolean(),
});

export const updateInvoicingPreferenceSchema = z.object({
  defaultInvoicePaymentTermId: z.string().optional().nullable(),
  defaultInvoiceTaxRateId: z.string().optional().nullable(),
  defaultInvoiceIntroduction: z.string().optional(),
  defaultInvoiceFooter: z.string().optional(),
  defaultCreditNoteFooter: z.string().optional(),
  lockInvoiceAfterValidation: z.coerce.boolean(),
  allowInvoiceFromQuote: z.coerce.boolean(),
  allowDraftInvoiceDeletionSandbox: z.coerce.boolean(),
  showSandboxLegalNotice: z.coerce.boolean(),
});

export const updateSupplierPreferenceSchema = z.object({
  defaultSupplierPaymentTermId: z.string().optional().nullable(),
  defaultSupplierTaxRateId: z.string().optional().nullable(),
  defaultExpenseCategoryId: z.string().optional().nullable(),
  requireSupplierInvoiceAttachment: z.coerce.boolean(),
  allowSupplierBankDetailsSandbox: z.coerce.boolean(),
  defaultSupplierRiskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const updateAccountingPreferenceSchema = z.object({
  defaultSalesJournalId: z.string().optional().nullable(),
  defaultPurchaseJournalId: z.string().optional().nullable(),
  defaultBankJournalId: z.string().optional().nullable(),
  defaultCashJournalId: z.string().optional().nullable(),
  defaultMiscJournalId: z.string().optional().nullable(),
  autoGenerateEntriesFromCustomerInvoices: z.coerce.boolean(),
  autoGenerateEntriesFromCustomerPayments: z.coerce.boolean(),
  autoGenerateEntriesFromSupplierInvoices: z.coerce.boolean(),
  requireBalancedEntriesForValidation: z.coerce.boolean(),
  allowDraftUnbalancedEntries: z.coerce.boolean(),
});

export const createAccountingMappingSchema = z.object({
  type: z.string(),
  label: z.string().min(1),
  accountId: z.string().min(1),
  taxRateId: z.string().optional(),
  expenseCategoryId: z.string().optional(),
  itemCategoryId: z.string().optional(),
  supplierCategoryId: z.string().optional(),
});

export const updateAccountingMappingSchema = createAccountingMappingSchema.partial();

export const updateNotificationPreferenceSchema = z.object({
  enabled: z.coerce.boolean(),
  channel: z.enum(["IN_APP", "EMAIL_SIMULATED"]),
  frequency: z.enum(["IMMEDIATE", "DAILY", "WEEKLY", "NEVER"]),
});

export const updateFeatureFlagSchema = z.object({
  enabled: z.coerce.boolean(),
});

export const createCustomFieldSchema = z
  .object({
    entityType: z.string(),
    label: z.string().min(1),
    key: z.string().optional(),
    fieldType: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"]),
    options: z.string().optional(),
    isRequired: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.fieldType === "SELECT" && !data.options) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Options requises pour une liste", path: ["options"] });
    }
  });
