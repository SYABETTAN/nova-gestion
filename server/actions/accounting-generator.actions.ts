"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import {
  buildCustomerInvoiceEntry,
  buildCustomerPaymentEntry,
  buildSupplierInvoiceEntry,
  entryDataToCreatePayload,
  findExistingValidatedEntry,
  loadAccountMap,
} from "@/lib/accounting-generators";
import { getJournalByCodeQuery } from "@/lib/accounting";
import { toDbDecimal } from "@/lib/money";

async function createGeneratedEntry(
  organizationId: string,
  userId: string,
  payload: ReturnType<typeof entryDataToCreatePayload>,
  auditAction:
    | "ACCOUNTING_ENTRY_GENERATED_FROM_CUSTOMER_INVOICE"
    | "ACCOUNTING_ENTRY_GENERATED_FROM_CUSTOMER_PAYMENT"
    | "ACCOUNTING_ENTRY_GENERATED_FROM_SUPPLIER_INVOICE",
) {
  const entryNumber = await generateNextNumber(organizationId, "ACCOUNTING_ENTRY", userId);

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.accountingEntry.create({
      data: {
        entryNumber,
        ...payload.payload,
        createdById: userId,
        validatedById: userId,
      },
    });

    await tx.accountingEntryLine.createMany({
      data: payload.lines.map((line, index) => ({
        organizationId,
        entryId: created.id,
        accountId: line.accountId,
        lineNumber: line.lineNumber ?? index,
        label: line.label,
        debit: toDbDecimal(line.debit),
        credit: toDbDecimal(line.credit),
        currency: line.currency ?? "EUR",
        customerId: line.customerId ?? null,
        supplierId: line.supplierId ?? null,
        invoiceId: line.invoiceId ?? null,
        supplierInvoiceId: line.supplierInvoiceId ?? null,
        paymentId: line.paymentId ?? null,
        taxRate: line.taxRate ?? null,
      })),
    });

    return created;
  });

  await createAuditLog({
    organizationId,
    userId,
    action: auditAction,
    entityType: "AccountingEntry",
    entityId: entry.id,
    entityLabel: entry.entryNumber,
  });

  return entry;
}

export async function generateAccountingEntryFromCustomerInvoiceAction(invoiceId: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_CREATE");

  const existing = await findExistingValidatedEntry(
    prisma,
    user.organizationId,
    "CUSTOMER_INVOICE",
    invoiceId,
  );
  if (existing) {
    return { success: false, error: "Une écriture validée existe déjà", entryId: existing.id };
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      organizationId: user.organizationId,
      status: { in: ["VALIDATED", "SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"] },
    },
    include: {
      customer: { select: { id: true, name: true } },
      lines: { select: { lineType: true, itemId: true } },
    },
  });
  if (!invoice) return { success: false, error: "Facture client non éligible" };

  const map = await loadAccountMap(prisma, user.organizationId);
  const journal = await getJournalByCodeQuery(user.organizationId, "VE");
  if (!journal) return { success: false, error: "Journal VE introuvable" };

  const entryData = buildCustomerInvoiceEntry(map, invoice);
  const payload = entryDataToCreatePayload(entryData, journal.id, user.organizationId);
  const entry = await createGeneratedEntry(
    user.organizationId,
    user.id,
    payload,
    "ACCOUNTING_ENTRY_GENERATED_FROM_CUSTOMER_INVOICE",
  );

  await prisma.invoiceActivity.create({
    data: {
      organizationId: user.organizationId,
      invoiceId,
      userId: user.id,
      type: "ACCOUNTING_ENTRY_GENERATED",
      title: "Écriture comptable générée",
      description: `Écriture ${entry.entryNumber} créée.`,
    },
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/accounting");
  return { success: true, entryId: entry.id, entryNumber: entry.entryNumber };
}

export async function generateAccountingEntryFromCustomerPaymentAction(paymentId: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_CREATE");

  const existing = await findExistingValidatedEntry(
    prisma,
    user.organizationId,
    "CUSTOMER_PAYMENT",
    paymentId,
  );
  if (existing) {
    return { success: false, error: "Une écriture validée existe déjà", entryId: existing.id };
  }

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      organizationId: user.organizationId,
      status: { in: ["CONFIRMED", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED"] },
    },
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!payment) return { success: false, error: "Paiement non éligible" };

  const map = await loadAccountMap(prisma, user.organizationId);
  const journalCode = payment.method === "CASH" ? "CA" : "BQ";
  const journal = await getJournalByCodeQuery(user.organizationId, journalCode);
  if (!journal) return { success: false, error: `Journal ${journalCode} introuvable` };

  const entryData = buildCustomerPaymentEntry(map, payment);
  const payload = entryDataToCreatePayload(entryData, journal.id, user.organizationId);
  const entry = await createGeneratedEntry(
    user.organizationId,
    user.id,
    payload,
    "ACCOUNTING_ENTRY_GENERATED_FROM_CUSTOMER_PAYMENT",
  );

  await prisma.paymentActivity.create({
    data: {
      organizationId: user.organizationId,
      paymentId,
      userId: user.id,
      type: "ACCOUNTING_ENTRY_GENERATED",
      title: "Écriture comptable générée",
      description: `Écriture ${entry.entryNumber} créée.`,
    },
  });

  revalidatePath(`/payments/${paymentId}`);
  revalidatePath("/accounting");
  return { success: true, entryId: entry.id, entryNumber: entry.entryNumber };
}

export async function generateAccountingEntryFromSupplierInvoiceAction(supplierInvoiceId: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_CREATE");

  const existing = await findExistingValidatedEntry(
    prisma,
    user.organizationId,
    "SUPPLIER_INVOICE",
    supplierInvoiceId,
  );
  if (existing) {
    return { success: false, error: "Une écriture validée existe déjà", entryId: existing.id };
  }

  const supplierInvoice = await prisma.supplierInvoice.findFirst({
    where: {
      id: supplierInvoiceId,
      organizationId: user.organizationId,
      status: "VALIDATED",
    },
    include: {
      supplier: { select: { id: true, name: true } },
      expenseCategory: { select: { name: true, accountingAccountPlaceholder: true } },
    },
  });
  if (!supplierInvoice) return { success: false, error: "Facture fournisseur non éligible" };

  const map = await loadAccountMap(prisma, user.organizationId);
  const journal = await getJournalByCodeQuery(user.organizationId, "AC");
  if (!journal) return { success: false, error: "Journal AC introuvable" };

  const entryData = buildSupplierInvoiceEntry(map, supplierInvoice);
  const payload = entryDataToCreatePayload(entryData, journal.id, user.organizationId);
  const entry = await createGeneratedEntry(
    user.organizationId,
    user.id,
    payload,
    "ACCOUNTING_ENTRY_GENERATED_FROM_SUPPLIER_INVOICE",
  );

  await prisma.supplierInvoiceActivity.create({
    data: {
      organizationId: user.organizationId,
      supplierInvoiceId,
      userId: user.id,
      type: "ACCOUNTING_ENTRY_GENERATED",
      title: "Écriture comptable générée",
      description: `Écriture ${entry.entryNumber} créée.`,
    },
  });

  revalidatePath(`/supplier-invoices/${supplierInvoiceId}`);
  revalidatePath("/accounting");
  return { success: true, entryId: entry.id, entryNumber: entry.entryNumber };
}

export async function generateMissingAccountingEntriesAction() {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_CREATE");

  let customerInvoicesProcessed = 0;
  let paymentsProcessed = 0;
  let supplierInvoicesProcessed = 0;
  let created = 0;
  let skipped = 0;

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: user.organizationId,
      status: { in: ["VALIDATED", "SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"] },
    },
    select: { id: true },
  });

  for (const invoice of invoices) {
    customerInvoicesProcessed++;
    const result = await generateAccountingEntryFromCustomerInvoiceAction(invoice.id);
    if (result.success) created++;
    else skipped++;
  }

  const payments = await prisma.payment.findMany({
    where: {
      organizationId: user.organizationId,
      status: { in: ["CONFIRMED", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED"] },
    },
    select: { id: true },
  });

  for (const payment of payments) {
    paymentsProcessed++;
    const result = await generateAccountingEntryFromCustomerPaymentAction(payment.id);
    if (result.success) created++;
    else skipped++;
  }

  const supplierInvoices = await prisma.supplierInvoice.findMany({
    where: { organizationId: user.organizationId, status: "VALIDATED" },
    select: { id: true },
  });

  for (const supplierInvoice of supplierInvoices) {
    supplierInvoicesProcessed++;
    const result = await generateAccountingEntryFromSupplierInvoiceAction(supplierInvoice.id);
    if (result.success) created++;
    else skipped++;
  }

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_MISSING_ENTRIES_GENERATED",
    entityType: "AccountingEntry",
    entityLabel: `${created} écritures créées`,
  });

  revalidatePath("/accounting");
  return {
    success: true,
    customerInvoicesProcessed,
    paymentsProcessed,
    supplierInvoicesProcessed,
    created,
    skipped,
  };
}
