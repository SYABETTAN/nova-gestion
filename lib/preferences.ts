export const DEFAULT_COMMERCIAL_PREFERENCE = {
  defaultQuoteValidityDays: 30,
  allowQuoteDiscounts: true,
  allowQuoteFreeTextLines: true,
  requireCustomerForQuote: true,
} as const;

export const DEFAULT_INVOICING_PREFERENCE = {
  lockInvoiceAfterValidation: true,
  allowInvoiceFromQuote: true,
  showSandboxLegalNotice: false,
  allowDraftInvoiceDeletionSandbox: false,
} as const;

export const DEFAULT_ACCOUNTING_PREFERENCE = {
  autoGenerateEntriesFromCustomerInvoices: false,
  autoGenerateEntriesFromCustomerPayments: false,
  autoGenerateEntriesFromSupplierInvoices: false,
  requireBalancedEntriesForValidation: true,
  allowDraftUnbalancedEntries: true,
} as const;

export function validateQuoteValidityDays(days: number): boolean {
  return days >= 1 && days <= 120;
}
