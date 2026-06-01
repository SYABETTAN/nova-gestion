import type { Prisma } from "@prisma/client";
import { toDbDecimal, type MoneyInput } from "@/lib/money";

type WithDbDecimals<T extends Record<string, unknown>, F extends keyof T> = Omit<T, F> & {
  [K in F]: Prisma.Decimal;
};

/** Convertit les champs monétaires d'un objet pour écriture Prisma. */
export function mapMoneyFieldsToDb<
  T extends Record<string, unknown>,
  F extends keyof T,
>(data: T, fields: F[]): WithDbDecimals<T, F> {
  const out = { ...data } as Record<string, unknown>;
  for (const field of fields) {
    const value = out[field as string];
    if (value !== undefined && value !== null) {
      out[field as string] = toDbDecimal(value as MoneyInput);
    }
  }
  return out as WithDbDecimals<T, F>;
}

export const INVOICE_TOTAL_FIELDS = [
  "subtotalExcludingTax",
  "totalDiscountAmount",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
  "amountPaid",
  "amountDue",
  "globalDiscountValue",
  "shippingAmountExcludingTax",
  "otherFeesExcludingTax",
] as const;

export const INVOICE_LINE_MONEY_FIELDS = [
  "quantity",
  "unitPriceExcludingTax",
  "discountValue",
  "discountAmount",
  "vatRate",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
] as const;

export const PAYMENT_MONEY_FIELDS = ["amount", "allocatedAmount", "unallocatedAmount"] as const;

export const ACCOUNTING_ENTRY_MONEY_FIELDS = ["totalDebit", "totalCredit"] as const;

export const ITEM_MONEY_FIELDS = [
  "defaultVatRate",
  "salePriceExcludingTax",
  "salePriceIncludingTax",
  "purchasePriceExcludingTax",
  "marginAmount",
  "marginRate",
  "stockQuantity",
  "stockAlertThreshold",
] as const;

export const CREDIT_NOTE_MONEY_FIELDS = [
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
] as const;

export const CREDIT_NOTE_LINE_MONEY_FIELDS = [
  "quantity",
  "unitPriceExcludingTax",
  "vatRate",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
] as const;

export const SUPPLIER_INVOICE_TOTAL_FIELDS = [
  "subtotalExcludingTax",
  "totalDiscountAmount",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
  "amountPaid",
  "amountDue",
] as const;

export const SUPPLIER_INVOICE_LINE_MONEY_FIELDS = [
  "quantity",
  "unitPriceExcludingTax",
  "discountAmount",
  "vatRate",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
] as const;

export const QUOTE_TOTAL_FIELDS = [
  "subtotalExcludingTax",
  "totalDiscountAmount",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
  "globalDiscountValue",
  "shippingAmountExcludingTax",
  "otherFeesExcludingTax",
] as const;
export const QUOTE_LINE_MONEY_FIELDS = INVOICE_LINE_MONEY_FIELDS;
