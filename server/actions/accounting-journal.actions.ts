"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createAccountingJournalSchema,
  updateAccountingJournalSchema,
} from "@/lib/accounting-validators";
import { listAccountingJournalsQuery } from "@/lib/accounting";

export async function listAccountingJournalsAction() {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  return listAccountingJournalsQuery(user.organizationId);
}

export async function createAccountingJournalAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_SETTINGS_UPDATE");

  const parsed = createAccountingJournalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const existing = await prisma.accountingJournal.findFirst({
    where: { organizationId: user.organizationId, code: parsed.data.code },
  });
  if (existing) return { success: false, error: "Ce code journal existe déjà" };

  const journal = await prisma.accountingJournal.create({
    data: { organizationId: user.organizationId, ...parsed.data },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_JOURNAL_CREATED",
    entityType: "AccountingJournal",
    entityId: journal.id,
    entityLabel: `${journal.code} - ${journal.name}`,
  });

  revalidatePath("/accounting/journals");
  return { success: true, journalId: journal.id };
}

export async function updateAccountingJournalAction(id: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_SETTINGS_UPDATE");

  const parsed = updateAccountingJournalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const journal = await prisma.accountingJournal.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!journal) return { success: false, error: "Journal introuvable" };

  await prisma.accountingJournal.update({ where: { id }, data: parsed.data });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_JOURNAL_UPDATED",
    entityType: "AccountingJournal",
    entityId: id,
    entityLabel: journal.code,
  });

  revalidatePath("/accounting/journals");
  return { success: true };
}

export async function disableAccountingJournalAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_SETTINGS_UPDATE");

  const journal = await prisma.accountingJournal.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!journal) return { success: false, error: "Journal introuvable" };

  await prisma.accountingJournal.update({ where: { id }, data: { isActive: false } });

  revalidatePath("/accounting/journals");
  return { success: true };
}
