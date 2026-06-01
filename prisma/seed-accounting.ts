import type { PrismaClient } from "@prisma/client";
import {
  isPositive,
  money,
  moneyAdd,
  moneyEq,
  moneyToNumber,
  toDbDecimal,
  type MoneyInput,
} from "../lib/money";
import { ACCOUNTING_ENTRY_MONEY_FIELDS, mapMoneyFieldsToDb } from "../lib/money-db";
import { roundMoney } from "../lib/pricing";
import {
  buildCustomerInvoiceEntry,
  buildCustomerPaymentEntry,
  buildSupplierInvoiceEntry,
  entryDataToCreatePayload,
  loadAccountMap,
} from "../lib/accounting-generators";
import { BOOTSTRAP_ACCOUNTS as ACCOUNTS, BOOTSTRAP_JOURNALS as JOURNALS } from "../lib/org-bootstrap-defaults";

async function createEntryWithLines(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
  entryNumber: string,
  journalId: string,
  data: {
    status: "DRAFT" | "VALIDATED" | "CANCELLED";
    sourceType: string;
    sourceId?: string | null;
    sourceLabel?: string | null;
    entryDate: Date;
    label: string;
    reference?: string | null;
    lines: {
      accountId: string;
      lineNumber: number;
      label: string;
      debit: MoneyInput;
      credit: MoneyInput;
      invoiceId?: string | null;
      supplierInvoiceId?: string | null;
      paymentId?: string | null;
      customerId?: string | null;
      supplierId?: string | null;
      taxRate?: MoneyInput | null;
    }[];
    generatedBySystem?: boolean;
  },
) {
  const totalDebit = roundMoney(
    moneyToNumber(data.lines.reduce((s, l) => moneyAdd(s, l.debit), money(0))),
  );
  const totalCredit = roundMoney(
    moneyToNumber(data.lines.reduce((s, l) => moneyAdd(s, l.credit), money(0))),
  );
  const isBalanced = moneyEq(totalDebit, totalCredit) && isPositive(totalDebit);
  const periodYear = data.entryDate.getFullYear();
  const periodMonth = data.entryDate.getMonth() + 1;

  const entry = await prisma.accountingEntry.create({
    data: {
      organizationId,
      entryNumber,
      journalId,
      status: data.status,
      sourceType: data.sourceType as never,
      sourceId: data.sourceId ?? null,
      sourceLabel: data.sourceLabel ?? null,
      entryDate: data.entryDate,
      periodYear,
      periodMonth,
      label: data.label,
      reference: data.reference ?? null,
      ...mapMoneyFieldsToDb({ totalDebit, totalCredit }, [...ACCOUNTING_ENTRY_MONEY_FIELDS]),
      isBalanced,
      generatedBySystem: data.generatedBySystem ?? false,
      createdById: userId,
      validatedById: data.status === "VALIDATED" ? userId : null,
      validatedAt: data.status === "VALIDATED" ? new Date() : null,
      postingDate: data.status === "VALIDATED" ? new Date() : null,
    },
  });

  await prisma.accountingEntryLine.createMany({
    data: data.lines.map((line) => ({
      organizationId,
      entryId: entry.id,
      accountId: line.accountId,
      lineNumber: line.lineNumber,
      label: line.label,
      debit: toDbDecimal(line.debit),
      credit: toDbDecimal(line.credit),
      invoiceId: line.invoiceId ?? null,
      supplierInvoiceId: line.supplierInvoiceId ?? null,
      paymentId: line.paymentId ?? null,
      customerId: line.customerId ?? null,
      supplierId: line.supplierId ?? null,
      taxRate: line.taxRate != null ? toDbDecimal(line.taxRate) : null,
      currency: "EUR",
    })),
  });

  return entry;
}

export async function seedAccounting(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
) {
  console.log("  Seeding accounting...");

  for (const account of ACCOUNTS) {
    await prisma.accountingAccount.upsert({
      where: {
        organizationId_accountNumber: {
          organizationId,
          accountNumber: account.accountNumber,
        },
      },
      update: { name: account.name, type: account.type as never, category: account.category as never, isSystem: true },
      create: {
        organizationId,
        ...account,
        type: account.type as never,
        category: account.category as never,
        isSystem: true,
        isActive: true,
      },
    });
  }

  const journalMap = new Map<string, string>();
  for (const journal of JOURNALS) {
    const j = await prisma.accountingJournal.upsert({
      where: { organizationId_code: { organizationId, code: journal.code } },
      update: { name: journal.name, type: journal.type as never, isSystem: true },
      create: {
        organizationId,
        ...journal,
        type: journal.type as never,
        isSystem: true,
        isActive: true,
      },
    });
    journalMap.set(journal.code, j.id);
  }

  const accountMap = await loadAccountMap(prisma, organizationId);
  let entryCounter = 1;
  const nextNumber = () => `ECR-2026-${String(entryCounter++).padStart(5, "0")}`;

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ["VALIDATED", "SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"] },
    },
    include: {
      customer: { select: { id: true, name: true } },
      lines: { select: { lineType: true, itemId: true } },
    },
    take: 35,
    orderBy: { issueDate: "asc" },
  });

  for (const invoice of invoices) {
    const data = buildCustomerInvoiceEntry(accountMap, invoice);
    const payload = entryDataToCreatePayload(data, journalMap.get("VE")!, organizationId);
    await createEntryWithLines(prisma, organizationId, userId, nextNumber(), journalMap.get("VE")!, {
      status: "VALIDATED",
      sourceType: payload.payload.sourceType,
      sourceId: payload.payload.sourceId,
      sourceLabel: payload.payload.sourceLabel,
      entryDate: payload.payload.entryDate,
      label: payload.payload.label,
      generatedBySystem: true,
      lines: payload.lines.map((l, i) => ({
        accountId: l.accountId,
        lineNumber: l.lineNumber ?? i,
        label: l.label,
        debit: l.debit,
        credit: l.credit,
        invoiceId: l.invoiceId ?? null,
        customerId: l.customerId ?? null,
        taxRate: l.taxRate ?? null,
      })),
    });
  }

  const payments = await prisma.payment.findMany({
    where: {
      organizationId,
      status: { in: ["CONFIRMED", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED"] },
    },
    include: { customer: { select: { id: true, name: true } } },
    take: 25,
    orderBy: { paymentDate: "asc" },
  });

  for (const payment of payments) {
    const data = buildCustomerPaymentEntry(accountMap, payment);
    const journalCode = payment.method === "CASH" ? "CA" : "BQ";
    const payload = entryDataToCreatePayload(data, journalMap.get(journalCode)!, organizationId);
    await createEntryWithLines(prisma, organizationId, userId, nextNumber(), journalMap.get(journalCode)!, {
      status: "VALIDATED",
      sourceType: payload.payload.sourceType,
      sourceId: payload.payload.sourceId,
      sourceLabel: payload.payload.sourceLabel,
      entryDate: payload.payload.entryDate,
      label: payload.payload.label,
      generatedBySystem: true,
      lines: payload.lines.map((l, i) => ({
        accountId: l.accountId,
        lineNumber: l.lineNumber ?? i,
        label: l.label,
        debit: l.debit,
        credit: l.credit,
        paymentId: l.paymentId ?? null,
        customerId: l.customerId ?? null,
      })),
    });
  }

  const supplierInvoices = await prisma.supplierInvoice.findMany({
    where: { organizationId, status: "VALIDATED" },
    include: {
      supplier: { select: { id: true, name: true } },
      expenseCategory: { select: { name: true, accountingAccountPlaceholder: true } },
    },
    take: 30,
    orderBy: { issueDate: "asc" },
  });

  for (const si of supplierInvoices) {
    const data = buildSupplierInvoiceEntry(accountMap, si);
    const payload = entryDataToCreatePayload(data, journalMap.get("AC")!, organizationId);
    await createEntryWithLines(prisma, organizationId, userId, nextNumber(), journalMap.get("AC")!, {
      status: "VALIDATED",
      sourceType: payload.payload.sourceType,
      sourceId: payload.payload.sourceId,
      sourceLabel: payload.payload.sourceLabel,
      entryDate: payload.payload.entryDate,
      label: payload.payload.label,
      generatedBySystem: true,
      lines: payload.lines.map((l, i) => ({
        accountId: l.accountId,
        lineNumber: l.lineNumber ?? i,
        label: l.label,
        debit: l.debit,
        credit: l.credit,
        supplierInvoiceId: l.supplierInvoiceId ?? null,
        supplierId: l.supplierId ?? null,
        taxRate: l.taxRate ?? null,
      })),
    });
  }

  const odJournalId = journalMap.get("OD")!;
  const bankId = accountMap.get("512000")!;
  const miscExpenseId = accountMap.get("658000")!;
  const miscRevenueId = accountMap.get("758000")!;
  const capitalId = accountMap.get("101000")!;
  const customerId = accountMap.get("411000")!;

  const manualEntries = [
    { label: "Solde d'ouverture", debit: 50000, credit: 0, accountDebit: capitalId, accountCredit: bankId },
    { label: "Frais bancaires", debit: 45, credit: 0, accountDebit: accountMap.get("627000")!, accountCredit: bankId },
    { label: "Produit divers", debit: 0, credit: 120, accountDebit: bankId, accountCredit: miscRevenueId },
    { label: "OD ajustement", debit: 200, credit: 0, accountDebit: miscExpenseId, accountCredit: customerId },
  ];

  for (let i = 0; i < 15; i++) {
    const template = manualEntries[i % manualEntries.length]!;
    const amount = roundMoney(template.debit || template.credit || 100);
    await createEntryWithLines(prisma, organizationId, userId, nextNumber(), odJournalId, {
      status: i < 10 ? "VALIDATED" : "DRAFT",
      sourceType: i === 0 ? "OPENING_BALANCE" : "MANUAL",
      entryDate: new Date(2026, i % 12, 1 + (i % 28)),
      label: `${template.label} #${i + 1}`,
      lines: [
        {
          accountId: template.accountDebit,
          lineNumber: 1,
          label: template.label,
          debit: template.debit > 0 ? amount : 0,
          credit: 0,
        },
        {
          accountId: template.accountCredit,
          lineNumber: 2,
          label: template.label,
          debit: 0,
          credit: template.debit > 0 ? amount : amount,
        },
      ],
    });
  }

  for (let i = 0; i < 5; i++) {
    await createEntryWithLines(prisma, organizationId, userId, nextNumber(), odJournalId, {
      status: "CANCELLED",
      sourceType: "OTHER",
      entryDate: new Date(2026, 0, 15 + i),
      label: `Écriture annulée #${i + 1}`,
      lines: [
        { accountId: miscExpenseId, lineNumber: 1, label: "Charge", debit: 100, credit: 0 },
        { accountId: bankId, lineNumber: 2, label: "Banque", debit: 0, credit: 100 },
      ],
    });
  }

  for (let i = 0; i < 10; i++) {
    await createEntryWithLines(prisma, organizationId, userId, nextNumber(), odJournalId, {
      status: "DRAFT",
      sourceType: "MANUAL",
      entryDate: new Date(2026, 2, 1 + i),
      label: `Brouillon non équilibré #${i + 1}`,
      lines: [
        { accountId: miscExpenseId, lineNumber: 1, label: "Charge provisoire", debit: 150 + i * 10, credit: 0 },
        { accountId: bankId, lineNumber: 2, label: "Banque provisoire", debit: 0, credit: 100 },
      ],
    });
  }

  const [entryCount, lineCount] = await Promise.all([
    prisma.accountingEntry.count({ where: { organizationId } }),
    prisma.accountingEntryLine.count({ where: { organizationId } }),
  ]);

  console.log(
    `  ✓ ${ACCOUNTS.length} accounts, ${JOURNALS.length} journals, ${entryCount} entries, ${lineCount} lines`,
  );
}

export async function cleanupAccountingModule(prisma: PrismaClient, organizationId: string) {
  await prisma.accountingEntryLine.deleteMany({ where: { organizationId } });
  await prisma.accountingEntry.deleteMany({ where: { organizationId } });
  await prisma.accountingJournal.deleteMany({ where: { organizationId, isSystem: false } });
  await prisma.accountingAccount.deleteMany({ where: { organizationId, isSystem: false } });
  await prisma.accountingEntryLine.deleteMany({ where: { organizationId } });
  await prisma.accountingEntry.deleteMany({ where: { organizationId } });
  await prisma.accountingJournal.deleteMany({ where: { organizationId } });
  await prisma.accountingAccount.deleteMany({ where: { organizationId } });
}
