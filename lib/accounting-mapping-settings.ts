import { prisma } from "@/lib/prisma";
import type { AccountingMappingType } from "@prisma/client";
import { SYSTEM_ACCOUNT_NUMBERS } from "@/lib/accounting-mapping";

const TYPE_TO_FALLBACK: Partial<Record<AccountingMappingType, string>> = {
  CUSTOMER_RECEIVABLE: SYSTEM_ACCOUNT_NUMBERS.CUSTOMERS,
  SUPPLIER_PAYABLE: SYSTEM_ACCOUNT_NUMBERS.SUPPLIERS,
  BANK: SYSTEM_ACCOUNT_NUMBERS.BANK,
  CASH: SYSTEM_ACCOUNT_NUMBERS.CASH,
  SALES_SERVICE: SYSTEM_ACCOUNT_NUMBERS.SERVICES,
  SALES_PRODUCT: SYSTEM_ACCOUNT_NUMBERS.GOODS_SALES,
  VAT_COLLECTED: SYSTEM_ACCOUNT_NUMBERS.VAT_COLLECTED,
  VAT_DEDUCTIBLE: SYSTEM_ACCOUNT_NUMBERS.VAT_DEDUCTIBLE,
  PURCHASE_EXPENSE: SYSTEM_ACCOUNT_NUMBERS.SUPPLIES,
  DISCOUNT: SYSTEM_ACCOUNT_NUMBERS.DISCOUNTS,
};

export async function resolveAccountNumberByMapping(
  organizationId: string,
  type: AccountingMappingType,
): Promise<string> {
  const mapping = await prisma.accountingMapping.findFirst({
    where: { organizationId, type, isActive: true, isDefault: true },
  });
  if (mapping) {
    const account = await prisma.accountingAccount.findFirst({
      where: { id: mapping.accountId, organizationId },
    });
    if (account) return account.accountNumber;
  }

  const anyMapping = await prisma.accountingMapping.findFirst({
    where: { organizationId, type, isActive: true },
  });
  if (anyMapping) {
    const account = await prisma.accountingAccount.findFirst({
      where: { id: anyMapping.accountId, organizationId },
    });
    if (account) return account.accountNumber;
  }

  return TYPE_TO_FALLBACK[type] ?? SYSTEM_ACCOUNT_NUMBERS.FEES;
}
