"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import {
  calculateAccountingEntryTotals,
  canValidateEntryTotals,
  getEntryPeriod,
  type AccountingEntryLineInput,
} from "@/lib/accounting-calculations";
import { toDbDecimal } from "@/lib/money";
import {
  canCancelAccountingEntry,
  isAccountingEntryEditable,
} from "@/lib/accounting-utils";
import {
  accountingEntryFilterSchema,
  cancelAccountingEntrySchema,
  createAccountingEntrySchema,
  updateAccountingEntrySchema,
} from "@/lib/accounting-validators";
import {
  getAccountingDashboardStatsQuery,
  getAccountingEntryByIdQuery,
  getAccountingEntryBySourceQuery,
  getAccountingFormDataQuery,
  listAccountingEntriesQuery,
} from "@/lib/accounting";

function parseLinesFromForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  let lines: unknown = [];
  if (typeof raw.lines === "string") {
    try {
      lines = JSON.parse(raw.lines);
    } catch {
      lines = [];
    }
  }
  return { ...raw, lines };
}

async function persistEntryLines(
  organizationId: string,
  entryId: string,
  lines: AccountingEntryLineInput[],
) {
  await prisma.accountingEntryLine.deleteMany({ where: { entryId, organizationId } });
  if (lines.length === 0) return;
  await prisma.accountingEntryLine.createMany({
    data: lines.map((line, index) => ({
      organizationId,
      entryId,
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
      taxRate: line.taxRate != null ? toDbDecimal(line.taxRate) : null,
    })),
  });
}

export async function listAccountingEntriesAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  const filters = accountingEntryFilterSchema.parse(searchParams);
  return listAccountingEntriesQuery(user.organizationId, filters);
}

export async function getAccountingDashboardStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  return getAccountingDashboardStatsQuery(user.organizationId);
}

export async function getAccountingEntryByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  return getAccountingEntryByIdQuery(user.organizationId, id);
}

export async function getAccountingEntryBySourceAction(sourceType: string, sourceId: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  return getAccountingEntryBySourceQuery(user.organizationId, sourceType, sourceId);
}

export async function getAccountingFormDataAction() {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  return getAccountingFormDataQuery(user.organizationId);
}

export async function createAccountingEntryAction(formData: FormData, validate = false) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_CREATE");

  const parsed = createAccountingEntrySchema.safeParse(parseLinesFromForm(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const totals = calculateAccountingEntryTotals(parsed.data.lines);
  if (validate && !canValidateEntryTotals(totals)) {
    return { success: false, error: "L'écriture doit être équilibrée avec au moins 2 lignes" };
  }

  const entryNumber = await generateNextNumber(user.organizationId, "ACCOUNTING_ENTRY", user.id);
  const period = getEntryPeriod(parsed.data.entryDate);

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.accountingEntry.create({
      data: {
        organizationId: user.organizationId,
        entryNumber,
        journalId: parsed.data.journalId,
        sourceType: "MANUAL",
        entryDate: parsed.data.entryDate,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        label: parsed.data.label,
        reference: parsed.data.reference ?? null,
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        isBalanced: totals.isBalanced,
        status: validate && totals.isBalanced ? "VALIDATED" : "DRAFT",
        postingDate: validate && totals.isBalanced ? new Date() : null,
        validatedAt: validate && totals.isBalanced ? new Date() : null,
        validatedById: validate && totals.isBalanced ? user.id : null,
        createdById: user.id,
      },
    });

    await tx.accountingEntryLine.createMany({
      data: totals.lines.map((line, index) => ({
        organizationId: user.organizationId,
        entryId: created.id,
        accountId: line.accountId,
        lineNumber: line.lineNumber ?? index,
        label: line.label,
        debit: line.debit,
        credit: line.credit,
        currency: line.currency ?? "EUR",
      })),
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ENTRY_CREATED",
    entityType: "AccountingEntry",
    entityId: entry.id,
    entityLabel: entry.entryNumber,
  });

  if (entry.status === "VALIDATED") {
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCOUNTING_ENTRY_VALIDATED",
      entityType: "AccountingEntry",
      entityId: entry.id,
      entityLabel: entry.entryNumber,
    });
  }

  revalidatePath("/accounting");
  revalidatePath("/accounting/entries");
  return { success: true, entryId: entry.id };
}

export async function updateAccountingEntryAction(id: string, formData: FormData, validate = false) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_UPDATE");

  const entry = await prisma.accountingEntry.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!entry) return { success: false, error: "Écriture introuvable" };
  if (!isAccountingEntryEditable(entry.status)) {
    return { success: false, error: "Cette écriture ne peut plus être modifiée" };
  }

  const parsed = updateAccountingEntrySchema.safeParse(parseLinesFromForm(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const totals = calculateAccountingEntryTotals(parsed.data.lines);
  if (validate && !canValidateEntryTotals(totals)) {
    return { success: false, error: "L'écriture doit être équilibrée avec au moins 2 lignes" };
  }

  const period = getEntryPeriod(parsed.data.entryDate);

  await prisma.$transaction(async (tx) => {
    await tx.accountingEntry.update({
      where: { id },
      data: {
        journalId: parsed.data.journalId,
        entryDate: parsed.data.entryDate,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        label: parsed.data.label,
        reference: parsed.data.reference ?? null,
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        isBalanced: totals.isBalanced,
        status: validate && totals.isBalanced ? "VALIDATED" : "DRAFT",
        postingDate: validate && totals.isBalanced ? new Date() : null,
        validatedAt: validate && totals.isBalanced ? new Date() : null,
        validatedById: validate && totals.isBalanced ? user.id : null,
      },
    });
    await persistEntryLines(user.organizationId, id, totals.lines);
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ENTRY_UPDATED",
    entityType: "AccountingEntry",
    entityId: id,
    entityLabel: entry.entryNumber,
  });

  if (validate && totals.isBalanced) {
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCOUNTING_ENTRY_VALIDATED",
      entityType: "AccountingEntry",
      entityId: id,
      entityLabel: entry.entryNumber,
    });
  }

  revalidatePath("/accounting");
  revalidatePath(`/accounting/entries/${id}`);
  return { success: true };
}

export async function validateAccountingEntryAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_VALIDATE");

  const entry = await getAccountingEntryByIdQuery(user.organizationId, id);
  if (!entry) return { success: false, error: "Écriture introuvable" };
  if (entry.status !== "DRAFT") return { success: false, error: "Seul un brouillon peut être validé" };

  const totals = calculateAccountingEntryTotals(
    entry.lines.map((l) => ({
      accountId: l.accountId,
      lineNumber: l.lineNumber,
      label: l.label,
      debit: l.debit,
      credit: l.credit,
    })),
  );

  if (!canValidateEntryTotals(totals)) {
    return { success: false, error: "L'écriture n'est pas équilibrée ou est incomplète" };
  }

  await prisma.accountingEntry.update({
    where: { id },
    data: {
      status: "VALIDATED",
      totalDebit: totals.totalDebit,
      totalCredit: totals.totalCredit,
      isBalanced: true,
      postingDate: new Date(),
      validatedAt: new Date(),
      validatedById: user.id,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ENTRY_VALIDATED",
    entityType: "AccountingEntry",
    entityId: id,
    entityLabel: entry.entryNumber,
  });

  revalidatePath("/accounting");
  revalidatePath(`/accounting/entries/${id}`);
  return { success: true };
}

export async function cancelAccountingEntryAction(id: string, reason: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_CANCEL");

  const parsed = cancelAccountingEntrySchema.safeParse({ reason });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const entry = await prisma.accountingEntry.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!entry) return { success: false, error: "Écriture introuvable" };
  if (!canCancelAccountingEntry(entry.status)) {
    return { success: false, error: "Cette écriture est déjà annulée" };
  }

  await prisma.accountingEntry.update({ where: { id }, data: { status: "CANCELLED" } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ENTRY_CANCELLED",
    entityType: "AccountingEntry",
    entityId: id,
    entityLabel: `${entry.entryNumber} — ${parsed.data.reason}`,
  });

  revalidatePath("/accounting");
  revalidatePath(`/accounting/entries/${id}`);
  return { success: true };
}

export async function duplicateAccountingEntryAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_CREATE");

  const entry = await getAccountingEntryByIdQuery(user.organizationId, id);
  if (!entry) return { success: false, error: "Écriture introuvable" };

  const entryNumber = await generateNextNumber(user.organizationId, "ACCOUNTING_ENTRY", user.id);
  const period = getEntryPeriod(entry.entryDate);

  const duplicate = await prisma.$transaction(async (tx) => {
    const created = await tx.accountingEntry.create({
      data: {
        organizationId: user.organizationId,
        entryNumber,
        journalId: entry.journalId,
        sourceType: "MANUAL",
        entryDate: entry.entryDate,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        label: `${entry.label} (Copie)`,
        reference: entry.reference,
        totalDebit: entry.totalDebit,
        totalCredit: entry.totalCredit,
        isBalanced: entry.isBalanced,
        status: "DRAFT",
        createdById: user.id,
      },
    });

    await tx.accountingEntryLine.createMany({
      data: entry.lines.map((line) => ({
        organizationId: user.organizationId,
        entryId: created.id,
        accountId: line.accountId,
        lineNumber: line.lineNumber,
        label: line.label,
        debit: line.debit,
        credit: line.credit,
        currency: line.currency,
        customerId: line.customerId,
        supplierId: line.supplierId,
        invoiceId: line.invoiceId,
        supplierInvoiceId: line.supplierInvoiceId,
        paymentId: line.paymentId,
        taxRate: line.taxRate,
      })),
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ENTRY_DUPLICATED",
    entityType: "AccountingEntry",
    entityId: duplicate.id,
    entityLabel: duplicate.entryNumber,
  });

  revalidatePath("/accounting/entries");
  return { success: true, entryId: duplicate.id };
}
