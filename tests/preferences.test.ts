import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCOUNTING_PREFERENCE,
  DEFAULT_COMMERCIAL_PREFERENCE,
  DEFAULT_INVOICING_PREFERENCE,
  validateQuoteValidityDays,
} from "@/lib/preferences";
import { updateCommercialPreferenceSchema } from "@/lib/settings-validators";

describe("preferences", () => {
  it("defaultQuoteValidityDays entre 1 et 120", () => {
    expect(validateQuoteValidityDays(30)).toBe(true);
    expect(validateQuoteValidityDays(0)).toBe(false);
    expect(updateCommercialPreferenceSchema.safeParse({ defaultQuoteValidityDays: 0 }).success).toBe(false);
  });

  it("lockInvoiceAfterValidation true par défaut", () => {
    expect(DEFAULT_INVOICING_PREFERENCE.lockInvoiceAfterValidation).toBe(true);
  });

  it("requireBalancedEntriesForValidation true par défaut", () => {
    expect(DEFAULT_ACCOUNTING_PREFERENCE.requireBalancedEntriesForValidation).toBe(true);
  });

  it("commercial defaults", () => {
    expect(DEFAULT_COMMERCIAL_PREFERENCE.defaultQuoteValidityDays).toBe(30);
  });
});
