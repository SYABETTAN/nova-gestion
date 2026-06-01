export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    out[key] = value;
  }
  return out;
}

export function parseCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

export function parseNullableId(value: unknown): string | null {
  if (typeof value !== "string" || value === "" || value === "none") return null;
  return value;
}

export function parseCommercialPreferenceForm(formData: FormData) {
  const raw = formDataToObject(formData);
  return {
    defaultQuoteValidityDays: Number(raw.defaultQuoteValidityDays),
    defaultQuoteIntroduction: String(raw.defaultQuoteIntroduction ?? ""),
    defaultQuoteFooter: String(raw.defaultQuoteFooter ?? ""),
    defaultCustomerPaymentTermId: parseNullableId(raw.defaultCustomerPaymentTermId),
    defaultCustomerTaxRateId: parseNullableId(raw.defaultCustomerTaxRateId),
    allowQuoteDiscounts: parseCheckbox(formData, "allowQuoteDiscounts"),
    allowQuoteFreeTextLines: parseCheckbox(formData, "allowQuoteFreeTextLines"),
    requireCustomerForQuote: parseCheckbox(formData, "requireCustomerForQuote"),
  };
}

export function parseInvoicingPreferenceForm(formData: FormData) {
  const raw = formDataToObject(formData);
  return {
    defaultInvoicePaymentTermId: parseNullableId(raw.defaultInvoicePaymentTermId),
    defaultInvoiceTaxRateId: parseNullableId(raw.defaultInvoiceTaxRateId),
    defaultInvoiceIntroduction: String(raw.defaultInvoiceIntroduction ?? ""),
    defaultInvoiceFooter: String(raw.defaultInvoiceFooter ?? ""),
    defaultCreditNoteFooter: String(raw.defaultCreditNoteFooter ?? ""),
    lockInvoiceAfterValidation: parseCheckbox(formData, "lockInvoiceAfterValidation"),
    allowInvoiceFromQuote: parseCheckbox(formData, "allowInvoiceFromQuote"),
    allowDraftInvoiceDeletionSandbox: parseCheckbox(formData, "allowDraftInvoiceDeletionSandbox"),
    showSandboxLegalNotice: parseCheckbox(formData, "showSandboxLegalNotice"),
  };
}

export function parseSupplierPreferenceForm(formData: FormData) {
  const raw = formDataToObject(formData);
  return {
    defaultSupplierPaymentTermId: parseNullableId(raw.defaultSupplierPaymentTermId),
    defaultSupplierTaxRateId: parseNullableId(raw.defaultSupplierTaxRateId),
    defaultExpenseCategoryId: parseNullableId(raw.defaultExpenseCategoryId),
    requireSupplierInvoiceAttachment: parseCheckbox(formData, "requireSupplierInvoiceAttachment"),
    allowSupplierBankDetailsSandbox: parseCheckbox(formData, "allowSupplierBankDetailsSandbox"),
    defaultSupplierRiskLevel: String(raw.defaultSupplierRiskLevel ?? "LOW") as "LOW" | "MEDIUM" | "HIGH",
  };
}

export function parseAccountingPreferenceForm(formData: FormData) {
  const raw = formDataToObject(formData);
  return {
    defaultSalesJournalId: parseNullableId(raw.defaultSalesJournalId),
    defaultPurchaseJournalId: parseNullableId(raw.defaultPurchaseJournalId),
    defaultBankJournalId: parseNullableId(raw.defaultBankJournalId),
    defaultCashJournalId: parseNullableId(raw.defaultCashJournalId),
    defaultMiscJournalId: parseNullableId(raw.defaultMiscJournalId),
    autoGenerateEntriesFromCustomerInvoices: parseCheckbox(formData, "autoGenerateEntriesFromCustomerInvoices"),
    autoGenerateEntriesFromCustomerPayments: parseCheckbox(formData, "autoGenerateEntriesFromCustomerPayments"),
    autoGenerateEntriesFromSupplierInvoices: parseCheckbox(formData, "autoGenerateEntriesFromSupplierInvoices"),
    requireBalancedEntriesForValidation: parseCheckbox(formData, "requireBalancedEntriesForValidation"),
    allowDraftUnbalancedEntries: parseCheckbox(formData, "allowDraftUnbalancedEntries"),
  };
}
