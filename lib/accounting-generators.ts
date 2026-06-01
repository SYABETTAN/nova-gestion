import type { PrismaClient } from "@prisma/client";
import { roundMoney } from "@/lib/pricing";
import { moneyAdd, type MoneyInput } from "@/lib/money";
import {
  ACCOUNTING_JOURNAL_CODES,
  getBankOrCashAccount,
  getRevenueAccountForInvoice,
  mapExpenseCategoryToAccount,
  SYSTEM_ACCOUNT_NUMBERS,
} from "@/lib/accounting-mapping";
import type { AccountingEntryLineInput } from "@/lib/accounting-calculations";
import { getEntryPeriod } from "@/lib/accounting-calculations";

type AccountMap = Map<string, string>;

export async function loadAccountMap(
  prisma: PrismaClient,
  organizationId: string,
): Promise<AccountMap> {
  const accounts = await prisma.accountingAccount.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, accountNumber: true },
  });
  return new Map(accounts.map((a) => [a.accountNumber, a.id]));
}

export function getAccountId(map: AccountMap, accountNumber: string): string {
  const id = map.get(accountNumber);
  if (!id) throw new Error(`Compte comptable ${accountNumber} introuvable`);
  return id;
}

export async function findExistingValidatedEntry(
  prisma: PrismaClient,
  organizationId: string,
  sourceType: string,
  sourceId: string,
) {
  return prisma.accountingEntry.findFirst({
    where: {
      organizationId,
      sourceType: sourceType as never,
      sourceId,
      status: "VALIDATED",
    },
  });
}

export type GeneratedEntryData = {
  journalCode: string;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  entryDate: Date;
  label: string;
  lines: AccountingEntryLineInput[];
};

export function buildCustomerInvoiceEntry(
  map: AccountMap,
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: Date;
    totalExcludingTax: MoneyInput;
    totalVatAmount: MoneyInput;
    totalIncludingTax: MoneyInput;
    customer: { id: string; name: string };
    lines: { lineType: string; itemId: string | null }[];
  },
): GeneratedEntryData {
  const hasProduct = invoice.lines.some((l) => l.lineType === "ITEM" || l.itemId);
  const revenueAccount = getRevenueAccountForInvoice(hasProduct);
  const ht = roundMoney(invoice.totalExcludingTax);
  const vat = roundMoney(invoice.totalVatAmount);
  const ttc = roundMoney(invoice.totalIncludingTax);

  return {
    journalCode: ACCOUNTING_JOURNAL_CODES.SALES,
    sourceType: "CUSTOMER_INVOICE",
    sourceId: invoice.id,
    sourceLabel: invoice.invoiceNumber,
    entryDate: invoice.issueDate,
    label: `Facture client ${invoice.invoiceNumber} - ${invoice.customer.name}`,
    lines: [
      {
        accountId: getAccountId(map, SYSTEM_ACCOUNT_NUMBERS.CUSTOMERS),
        lineNumber: 1,
        label: `Client ${invoice.customer.name}`,
        debit: ttc,
        credit: 0,
        customerId: invoice.customer.id,
        invoiceId: invoice.id,
      },
      {
        accountId: getAccountId(map, revenueAccount),
        lineNumber: 2,
        label: "Produits / services",
        debit: 0,
        credit: ht,
        invoiceId: invoice.id,
      },
      {
        accountId: getAccountId(map, SYSTEM_ACCOUNT_NUMBERS.VAT_COLLECTED),
        lineNumber: 3,
        label: "TVA collectée",
        debit: 0,
        credit: vat,
        invoiceId: invoice.id,
        taxRate: vat > 0 ? roundMoney((vat / ht) * 100) : 0,
      },
    ],
  };
}

export function buildCustomerPaymentEntry(
  map: AccountMap,
  payment: {
    id: string;
    paymentNumber: string;
    paymentDate: Date;
    amount: MoneyInput;
    method: string;
    customer: { id: string; name: string };
  },
): GeneratedEntryData {
  const amount = roundMoney(payment.amount);
  const bankAccount = getBankOrCashAccount(payment.method);
  const journalCode =
    payment.method === "CASH" ? ACCOUNTING_JOURNAL_CODES.CASH : ACCOUNTING_JOURNAL_CODES.BANK;

  return {
    journalCode,
    sourceType: "CUSTOMER_PAYMENT",
    sourceId: payment.id,
    sourceLabel: payment.paymentNumber,
    entryDate: payment.paymentDate,
    label: `Règlement client ${payment.paymentNumber} - ${payment.customer.name}`,
    lines: [
      {
        accountId: getAccountId(map, bankAccount),
        lineNumber: 1,
        label: payment.method === "CASH" ? "Caisse" : "Banque",
        debit: amount,
        credit: 0,
        paymentId: payment.id,
        customerId: payment.customer.id,
      },
      {
        accountId: getAccountId(map, SYSTEM_ACCOUNT_NUMBERS.CUSTOMERS),
        lineNumber: 2,
        label: `Client ${payment.customer.name}`,
        debit: 0,
        credit: amount,
        paymentId: payment.id,
        customerId: payment.customer.id,
      },
    ],
  };
}

export function buildSupplierInvoiceEntry(
  map: AccountMap,
  supplierInvoice: {
    id: string;
    supplierInvoiceNumber: string;
    issueDate: Date;
    totalExcludingTax: MoneyInput;
    totalVatAmount: MoneyInput;
    totalIncludingTax: MoneyInput;
    supplier: { id: string; name: string };
    expenseCategory?: { name: string; accountingAccountPlaceholder: string | null } | null;
  },
): GeneratedEntryData {
  let chargeAccount = mapExpenseCategoryToAccount(
    supplierInvoice.expenseCategory?.name,
    supplierInvoice.expenseCategory?.accountingAccountPlaceholder,
  );
  if (!map.has(chargeAccount)) {
    chargeAccount = SYSTEM_ACCOUNT_NUMBERS.FEES;
  }
  const ht = roundMoney(supplierInvoice.totalExcludingTax);
  const vat = roundMoney(supplierInvoice.totalVatAmount);
  const ttc = roundMoney(supplierInvoice.totalIncludingTax);

  return {
    journalCode: ACCOUNTING_JOURNAL_CODES.PURCHASES,
    sourceType: "SUPPLIER_INVOICE",
    sourceId: supplierInvoice.id,
    sourceLabel: supplierInvoice.supplierInvoiceNumber,
    entryDate: supplierInvoice.issueDate,
    label: `Facture fournisseur ${supplierInvoice.supplierInvoiceNumber} - ${supplierInvoice.supplier.name}`,
    lines: [
      {
        accountId: getAccountId(map, chargeAccount),
        lineNumber: 1,
        label: "Charge",
        debit: ht,
        credit: 0,
        supplierId: supplierInvoice.supplier.id,
        supplierInvoiceId: supplierInvoice.id,
      },
      {
        accountId: getAccountId(map, SYSTEM_ACCOUNT_NUMBERS.VAT_DEDUCTIBLE),
        lineNumber: 2,
        label: "TVA déductible",
        debit: vat,
        credit: 0,
        supplierInvoiceId: supplierInvoice.id,
        taxRate: vat > 0 && ht > 0 ? roundMoney((vat / ht) * 100) : 0,
      },
      {
        accountId: getAccountId(map, SYSTEM_ACCOUNT_NUMBERS.SUPPLIERS),
        lineNumber: 3,
        label: `Fournisseur ${supplierInvoice.supplier.name}`,
        debit: 0,
        credit: ttc,
        supplierId: supplierInvoice.supplier.id,
        supplierInvoiceId: supplierInvoice.id,
      },
    ],
  };
}

export function entryDataToCreatePayload(
  data: GeneratedEntryData,
  journalId: string,
  organizationId: string,
) {
  const period = getEntryPeriod(data.entryDate);
  const totalDebit = roundMoney(
    data.lines.reduce((s, l) => moneyAdd(s, l.debit ?? 0), moneyAdd(0, 0)),
  );
  const totalCredit = roundMoney(
    data.lines.reduce((s, l) => moneyAdd(s, l.credit ?? 0), moneyAdd(0, 0)),
  );
  return {
    payload: {
      organizationId,
      journalId,
      sourceType: data.sourceType as never,
      sourceId: data.sourceId,
      sourceLabel: data.sourceLabel,
      entryDate: data.entryDate,
      periodYear: period.periodYear,
      periodMonth: period.periodMonth,
      label: data.label,
      totalDebit,
      totalCredit,
      isBalanced: totalDebit === totalCredit,
      generatedBySystem: true,
      status: "VALIDATED" as const,
      postingDate: new Date(),
      validatedAt: new Date(),
    },
    lines: data.lines,
  };
}
