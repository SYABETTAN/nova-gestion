import type { Customer } from "@prisma/client";
import type { MoneyInput } from "@/lib/money";

export const CUSTOMER_CSV_HEADERS = [
  "customerNumber",
  "name",
  "legalName",
  "type",
  "status",
  "email",
  "phone",
  "city",
  "country",
  "siret",
  "vatNumber",
  "defaultPaymentTermsDays",
  "creditLimit",
  "outstandingAmount",
  "createdAt",
] as const;

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCustomersCsv(
  customers: (Customer & {
    addresses?: { city: string; country: string; isDefault: boolean }[];
  })[],
): string {
  const rows = [CUSTOMER_CSV_HEADERS.join(",")];

  for (const customer of customers) {
    const defaultAddress =
      customer.addresses?.find((a) => a.isDefault) ?? customer.addresses?.[0];

    const row = [
      customer.customerNumber,
      customer.name,
      customer.legalName ?? "",
      customer.type,
      customer.status,
      customer.email ?? "",
      customer.phone ?? "",
      defaultAddress?.city ?? "",
      defaultAddress?.country ?? "",
      customer.siret ?? "",
      customer.vatNumber ?? "",
      customer.defaultPaymentTermsDays,
      customer.creditLimit,
      customer.outstandingAmount,
      customer.createdAt.toISOString(),
    ].map(escapeCsvValue);

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

export const ITEM_CSV_HEADERS = [
  "itemNumber",
  "sku",
  "type",
  "status",
  "name",
  "category",
  "unit",
  "defaultVatRate",
  "salePriceExcludingTax",
  "salePriceIncludingTax",
  "purchasePriceExcludingTax",
  "marginAmount",
  "marginRate",
  "currency",
  "isRecurring",
  "recurringInterval",
  "isStockable",
  "stockQuantity",
  "createdAt",
] as const;

type ItemCsvRow = {
  itemNumber: string;
  sku: string | null;
  type: string;
  status: string;
  name: string;
  defaultVatRate: MoneyInput;
  salePriceExcludingTax: MoneyInput;
  salePriceIncludingTax: MoneyInput;
  purchasePriceExcludingTax: MoneyInput;
  marginAmount: MoneyInput;
  marginRate: MoneyInput;
  currency: string;
  isRecurring: boolean;
  recurringInterval: string | null;
  isStockable: boolean;
  stockQuantity: MoneyInput;
  createdAt: Date;
  category?: { name: string } | null;
  unit?: { symbol: string } | null;
};

export function generateItemsCsv(items: ItemCsvRow[]): string {
  const rows = [ITEM_CSV_HEADERS.join(",")];

  for (const item of items) {
    const row = [
      item.itemNumber,
      item.sku ?? "",
      item.type,
      item.status,
      item.name,
      item.category?.name ?? "",
      item.unit?.symbol ?? "",
      item.defaultVatRate,
      item.salePriceExcludingTax,
      item.salePriceIncludingTax,
      item.purchasePriceExcludingTax,
      item.marginAmount,
      item.marginRate,
      item.currency,
      item.isRecurring,
      item.recurringInterval ?? "",
      item.isStockable,
      item.stockQuantity,
      item.createdAt.toISOString(),
    ].map(escapeCsvValue);

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

export const QUOTE_CSV_HEADERS = [
  "quoteNumber",
  "customerName",
  "status",
  "title",
  "issueDate",
  "validUntil",
  "currency",
  "subtotalExcludingTax",
  "totalDiscountAmount",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
  "createdAt",
] as const;

type QuoteCsvRow = {
  quoteNumber: string;
  status: string;
  title: string;
  issueDate: Date;
  validUntil: Date;
  currency: string;
  subtotalExcludingTax: MoneyInput;
  totalDiscountAmount: MoneyInput;
  totalExcludingTax: MoneyInput;
  totalVatAmount: MoneyInput;
  totalIncludingTax: MoneyInput;
  createdAt: Date;
  customer: { name: string };
};

export function generateQuotesCsv(quotes: QuoteCsvRow[]): string {
  const rows = [QUOTE_CSV_HEADERS.join(",")];

  for (const quote of quotes) {
    const row = [
      quote.quoteNumber,
      quote.customer.name,
      quote.status,
      quote.title,
      quote.issueDate.toISOString().slice(0, 10),
      quote.validUntil.toISOString().slice(0, 10),
      quote.currency,
      quote.subtotalExcludingTax,
      quote.totalDiscountAmount,
      quote.totalExcludingTax,
      quote.totalVatAmount,
      quote.totalIncludingTax,
      quote.createdAt.toISOString(),
    ].map(escapeCsvValue);

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

export const INVOICE_CSV_HEADERS = [
  "invoiceNumber",
  "customerName",
  "type",
  "status",
  "paymentStatus",
  "issueDate",
  "dueDate",
  "currency",
  "subtotalExcludingTax",
  "totalDiscountAmount",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
  "amountPaid",
  "amountDue",
  "quoteNumber",
  "createdAt",
] as const;

type InvoiceCsvRow = {
  invoiceNumber: string;
  type: string;
  status: string;
  paymentStatus: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotalExcludingTax: MoneyInput;
  totalDiscountAmount: MoneyInput;
  totalExcludingTax: MoneyInput;
  totalVatAmount: MoneyInput;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  createdAt: Date;
  customer: { name: string };
  quote: { quoteNumber: string } | null;
};

export function generateInvoicesCsv(invoices: InvoiceCsvRow[]): string {
  const rows = [INVOICE_CSV_HEADERS.join(",")];

  for (const invoice of invoices) {
    const row = [
      invoice.invoiceNumber,
      invoice.customer.name,
      invoice.type,
      invoice.status,
      invoice.paymentStatus,
      invoice.issueDate.toISOString().slice(0, 10),
      invoice.dueDate.toISOString().slice(0, 10),
      invoice.currency,
      invoice.subtotalExcludingTax,
      invoice.totalDiscountAmount,
      invoice.totalExcludingTax,
      invoice.totalVatAmount,
      invoice.totalIncludingTax,
      invoice.amountPaid,
      invoice.amountDue,
      invoice.quote?.quoteNumber ?? "",
      invoice.createdAt.toISOString(),
    ].map(escapeCsvValue);

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

export const PAYMENT_CSV_HEADERS = [
  "paymentNumber",
  "customerName",
  "status",
  "method",
  "paymentDate",
  "amount",
  "allocatedAmount",
  "unallocatedAmount",
  "currency",
  "reference",
  "bankReference",
  "checkNumber",
  "cardLast4",
  "createdAt",
] as const;

type PaymentCsvRow = {
  paymentNumber: string;
  status: string;
  method: string;
  paymentDate: Date;
  amount: MoneyInput;
  allocatedAmount: MoneyInput;
  unallocatedAmount: MoneyInput;
  currency: string;
  reference: string | null;
  bankReference: string | null;
  checkNumber: string | null;
  cardLast4: string | null;
  createdAt: Date;
  customer: { name: string };
};

export function generatePaymentsCsv(payments: PaymentCsvRow[]): string {
  const rows = [PAYMENT_CSV_HEADERS.join(",")];

  for (const payment of payments) {
    const row = [
      payment.paymentNumber,
      payment.customer.name,
      payment.status,
      payment.method,
      payment.paymentDate.toISOString().slice(0, 10),
      payment.amount,
      payment.allocatedAmount,
      payment.unallocatedAmount,
      payment.currency,
      payment.reference ?? "",
      payment.bankReference ?? "",
      payment.checkNumber ?? "",
      payment.cardLast4 ?? "",
      payment.createdAt.toISOString(),
    ].map(escapeCsvValue);

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

export const REMINDERS_CSV_HEADERS = [
  "customerName",
  "customerEmail",
  "invoiceNumber",
  "invoiceIssueDate",
  "invoiceDueDate",
  "daysOverdue",
  "invoiceTotalIncludingTax",
  "invoiceAmountPaid",
  "invoiceAmountDue",
  "recommendedLevel",
  "lastReminderAt",
  "reminderCount",
  "reminderStatus",
  "isCollectionPaused",
  "isDisputed",
  "promisedPaymentDate",
] as const;

type ReminderInvoiceCsvRow = {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  daysOverdue: MoneyInput;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  recommendedLevel: string;
  lastReminderAt: Date | null;
  reminderCount: number;
  reminderStatus: string;
  isCollectionPaused: boolean;
  isDisputed: boolean;
  promisedPaymentDate: Date | null;
  customer: { name: string; email: string | null };
};

export function generateRemindersCsv(invoices: ReminderInvoiceCsvRow[]): string {
  const rows = [REMINDERS_CSV_HEADERS.join(",")];
  for (const inv of invoices) {
    rows.push(
      [
        inv.customer.name,
        inv.customer.email ?? "",
        inv.invoiceNumber,
        inv.issueDate.toISOString().slice(0, 10),
        inv.dueDate.toISOString().slice(0, 10),
        inv.daysOverdue,
        inv.totalIncludingTax,
        inv.amountPaid,
        inv.amountDue,
        inv.recommendedLevel,
        inv.lastReminderAt?.toISOString() ?? "",
        inv.reminderCount,
        inv.reminderStatus,
        inv.isCollectionPaused,
        inv.isDisputed,
        inv.promisedPaymentDate?.toISOString().slice(0, 10) ?? "",
      ].map(escapeCsvValue).join(","),
    );
  }
  return rows.join("\n");
}

export const REMINDER_HISTORY_CSV_HEADERS = [
  "reminderNumber",
  "customerName",
  "invoiceNumber",
  "level",
  "status",
  "channel",
  "recipientEmail",
  "subject",
  "daysOverdue",
  "invoiceAmountDue",
  "simulatedSentAt",
  "createdAt",
] as const;

type ReminderHistoryCsvRow = {
  reminderNumber: string;
  level: string;
  status: string;
  channel: string;
  recipientEmail: string;
  subject: string;
  daysOverdue: number;
  invoiceAmountDue: MoneyInput;
  simulatedSentAt: Date | null;
  createdAt: Date;
  customer: { name: string };
  invoice: { invoiceNumber: string };
};

export function generateReminderHistoryCsv(reminders: ReminderHistoryCsvRow[]): string {
  const rows = [REMINDER_HISTORY_CSV_HEADERS.join(",")];
  for (const r of reminders) {
    rows.push(
      [
        r.reminderNumber,
        r.customer.name,
        r.invoice.invoiceNumber,
        r.level,
        r.status,
        r.channel,
        r.recipientEmail,
        r.subject,
        r.daysOverdue,
        r.invoiceAmountDue,
        r.simulatedSentAt?.toISOString() ?? "",
        r.createdAt.toISOString(),
      ].map(escapeCsvValue).join(","),
    );
  }
  return rows.join("\n");
}

export const SUPPLIER_CSV_HEADERS = [
  "supplierNumber",
  "name",
  "legalName",
  "type",
  "status",
  "category",
  "email",
  "phone",
  "city",
  "country",
  "siret",
  "vatNumber",
  "defaultPaymentTermsDays",
  "defaultVatRate",
  "currency",
  "outstandingAmount",
  "totalPurchasesAmount",
  "riskLevel",
  "isPreferred",
  "createdAt",
] as const;

type SupplierCsvRow = {
  supplierNumber: string;
  name: string;
  legalName: string | null;
  type: string;
  status: string;
  email: string | null;
  phone: string | null;
  siret: string | null;
  vatNumber: string | null;
  defaultPaymentTermsDays: number;
  defaultVatRate: MoneyInput;
  currency: string;
  outstandingAmount: MoneyInput;
  totalPurchasesAmount: MoneyInput;
  riskLevel: string;
  isPreferred: boolean;
  createdAt: Date;
  category?: { name: string } | null;
  addresses?: { city: string; country: string }[];
};

export function generateSuppliersCsv(suppliers: SupplierCsvRow[]): string {
  const rows = [SUPPLIER_CSV_HEADERS.join(",")];

  for (const supplier of suppliers) {
    const defaultAddress = supplier.addresses?.[0];
    rows.push(
      [
        supplier.supplierNumber,
        supplier.name,
        supplier.legalName ?? "",
        supplier.type,
        supplier.status,
        supplier.category?.name ?? "",
        supplier.email ?? "",
        supplier.phone ?? "",
        defaultAddress?.city ?? "",
        defaultAddress?.country ?? "",
        supplier.siret ?? "",
        supplier.vatNumber ?? "",
        supplier.defaultPaymentTermsDays,
        supplier.defaultVatRate,
        supplier.currency,
        supplier.outstandingAmount,
        supplier.totalPurchasesAmount,
        supplier.riskLevel,
        supplier.isPreferred ? "true" : "false",
        supplier.createdAt.toISOString(),
      ].map(escapeCsvValue).join(","),
    );
  }

  return rows.join("\n");
}

export const SUPPLIER_INVOICE_CSV_HEADERS = [
  "supplierInvoiceNumber",
  "supplierReference",
  "supplierName",
  "status",
  "paymentStatus",
  "type",
  "expenseCategory",
  "issueDate",
  "receivedDate",
  "dueDate",
  "currency",
  "subtotalExcludingTax",
  "totalDiscountAmount",
  "totalExcludingTax",
  "totalVatAmount",
  "totalIncludingTax",
  "amountPaid",
  "amountDue",
  "createdAt",
] as const;

type SupplierInvoiceCsvRow = {
  supplierInvoiceNumber: string;
  supplierReference: string | null;
  status: string;
  paymentStatus: string;
  type: string;
  issueDate: Date;
  receivedDate: Date;
  dueDate: Date;
  currency: string;
  subtotalExcludingTax: MoneyInput;
  totalDiscountAmount: MoneyInput;
  totalExcludingTax: MoneyInput;
  totalVatAmount: MoneyInput;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  createdAt: Date;
  supplier: { name: string };
  expenseCategory: { name: string } | null;
};

export function generateSupplierInvoicesCsv(invoices: SupplierInvoiceCsvRow[]): string {
  const rows = [SUPPLIER_INVOICE_CSV_HEADERS.join(",")];
  for (const inv of invoices) {
    rows.push(
      [
        inv.supplierInvoiceNumber,
        inv.supplierReference ?? "",
        inv.supplier.name,
        inv.status,
        inv.paymentStatus,
        inv.type,
        inv.expenseCategory?.name ?? "",
        inv.issueDate.toISOString(),
        inv.receivedDate.toISOString(),
        inv.dueDate.toISOString(),
        inv.currency,
        inv.subtotalExcludingTax,
        inv.totalDiscountAmount,
        inv.totalExcludingTax,
        inv.totalVatAmount,
        inv.totalIncludingTax,
        inv.amountPaid,
        inv.amountDue,
        inv.createdAt.toISOString(),
      ].map(escapeCsvValue).join(","),
    );
  }
  return rows.join("\n");
}

export const ACCOUNTING_ENTRIES_CSV_HEADERS = [
  "entryNumber",
  "entryDate",
  "journalCode",
  "status",
  "sourceType",
  "sourceLabel",
  "label",
  "totalDebit",
  "totalCredit",
  "isBalanced",
  "createdAt",
] as const;

type AccountingEntryCsvRow = {
  entryNumber: string;
  entryDate: Date;
  status: string;
  sourceType: string;
  sourceLabel: string | null;
  label: string;
  totalDebit: MoneyInput;
  totalCredit: MoneyInput;
  isBalanced: boolean;
  createdAt: Date;
  journal: { code: string };
  lines?: {
    label: string;
    debit: MoneyInput;
    credit: MoneyInput;
    account: { accountNumber: string; name: string };
  }[];
};

export function generateAccountingEntriesCsv(entries: AccountingEntryCsvRow[]): string {
  const rows = [ACCOUNTING_ENTRIES_CSV_HEADERS.join(",")];
  for (const e of entries) {
    rows.push(
      [
        e.entryNumber,
        e.entryDate.toISOString(),
        e.journal.code,
        e.status,
        e.sourceType,
        e.sourceLabel ?? "",
        e.label,
        e.totalDebit,
        e.totalCredit,
        e.isBalanced,
        e.createdAt.toISOString(),
      ]
        .map(escapeCsvValue)
        .join(","),
    );
  }
  return rows.join("\n");
}

export function generateAccountingEntryLinesCsv(entries: AccountingEntryCsvRow[]): string {
  const headers = [
    "entryNumber",
    "entryDate",
    "journalCode",
    "accountNumber",
    "accountName",
    "lineLabel",
    "debit",
    "credit",
    "sourceType",
    "sourceLabel",
  ];
  const rows = [headers.join(",")];
  for (const e of entries) {
    for (const line of e.lines ?? []) {
      rows.push(
        [
          e.entryNumber,
          e.entryDate.toISOString(),
          e.journal.code,
          line.account.accountNumber,
          line.account.name,
          line.label,
          line.debit,
          line.credit,
          e.sourceType,
          e.sourceLabel ?? "",
        ]
          .map(escapeCsvValue)
          .join(","),
      );
    }
  }
  return rows.join("\n");
}

type AccountCsvRow = {
  accountNumber: string;
  name: string;
  type: string;
  category: string;
  isActive: boolean;
  isSystem: boolean;
  description: string | null;
};

export function generateAccountsCsv(accounts: AccountCsvRow[]): string {
  const headers = ["accountNumber", "name", "type", "category", "isActive", "isSystem", "description"];
  const rows = [headers.join(",")];
  for (const a of accounts) {
    rows.push(
      [a.accountNumber, a.name, a.type, a.category, a.isActive, a.isSystem, a.description ?? ""]
        .map(escapeCsvValue)
        .join(","),
    );
  }
  return rows.join("\n");
}

type GeneralLedgerCsvRow = {
  entryDate: Date;
  journalCode: string;
  entryNumber: string;
  accountNumber: string;
  accountName: string;
  label: string;
  debit: MoneyInput;
  credit: MoneyInput;
  runningBalance: number;
};

export function generateGeneralLedgerCsv(rows: GeneralLedgerCsvRow[]): string {
  const headers = [
    "date",
    "journal",
    "entryNumber",
    "accountNumber",
    "accountName",
    "label",
    "debit",
    "credit",
    "runningBalance",
  ];
  const out = [headers.join(",")];
  for (const r of rows) {
    out.push(
      [
        r.entryDate.toISOString(),
        r.journalCode,
        r.entryNumber,
        r.accountNumber,
        r.accountName,
        r.label,
        r.debit,
        r.credit,
        r.runningBalance,
      ]
        .map(escapeCsvValue)
        .join(","),
    );
  }
  return out.join("\n");
}

type TrialBalanceCsvRow = {
  accountNumber: string;
  accountName: string;
  totalDebit: MoneyInput;
  totalCredit: MoneyInput;
  debitBalance: MoneyInput;
  creditBalance: MoneyInput;
};

export function generateTrialBalanceCsv(rows: TrialBalanceCsvRow[]): string {
  const headers = [
    "accountNumber",
    "accountName",
    "totalDebit",
    "totalCredit",
    "debitBalance",
    "creditBalance",
  ];
  const out = [headers.join(",")];
  for (const r of rows) {
    out.push(
      [
        r.accountNumber,
        r.accountName,
        r.totalDebit,
        r.totalCredit,
        r.debitBalance,
        r.creditBalance,
      ]
        .map(escapeCsvValue)
        .join(","),
    );
  }
  return out.join("\n");
}

type VatSummaryCsvRow = {
  date: Date;
  sourceType: string;
  documentNumber: string;
  partyName: string;
  baseExcludingTax: number;
  vatAmount: MoneyInput;
  totalIncludingTax: MoneyInput;
};

export const DASHBOARD_KPI_CSV_HEADERS = [
  "section",
  "metricKey",
  "metricLabel",
  "value",
  "currency",
  "periodStart",
  "periodEnd",
  "generatedAt",
] as const;

export type DashboardKpiCsvRow = {
  section: string;
  metricKey: string;
  metricLabel: string;
  value: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
};

export function generateDashboardKpisCsv(rows: DashboardKpiCsvRow[]): string {
  const out = [DASHBOARD_KPI_CSV_HEADERS.join(",")];
  for (const row of rows) {
    out.push(
      [
        row.section,
        row.metricKey,
        row.metricLabel,
        row.value,
        row.currency,
        row.periodStart,
        row.periodEnd,
        row.generatedAt,
      ]
        .map(escapeCsvValue)
        .join(","),
    );
  }
  return out.join("\n");
}

export function generateVatSummaryCsv(rows: VatSummaryCsvRow[]): string {
  const headers = [
    "date",
    "sourceType",
    "documentNumber",
    "partyName",
    "baseExcludingTax",
    "vatAmount",
    "totalIncludingTax",
  ];
  const out = [headers.join(",")];
  for (const r of rows) {
    out.push(
      [
        r.date.toISOString(),
        r.sourceType,
        r.documentNumber,
        r.partyName,
        r.baseExcludingTax,
        r.vatAmount,
        r.totalIncludingTax,
      ]
        .map(escapeCsvValue)
        .join(","),
    );
  }
  return out.join("\n");
}
