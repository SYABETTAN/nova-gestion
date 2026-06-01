"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateAccountsCsv } from "@/lib/csv";
import {
  createAccountingAccountSchema,
  updateAccountingAccountSchema,
} from "@/lib/accounting-validators";
import { listAccountingAccountsQuery } from "@/lib/accounting";

export async function listAccountingAccountsAction(filters?: {
  q?: string;
  type?: string;
  category?: string;
  active?: string;
}) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  return listAccountingAccountsQuery(user.organizationId, filters);
}

export async function createAccountingAccountAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_SETTINGS_UPDATE");

  const parsed = createAccountingAccountSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const existing = await prisma.accountingAccount.findFirst({
    where: { organizationId: user.organizationId, accountNumber: parsed.data.accountNumber },
  });
  if (existing) return { success: false, error: "Ce numéro de compte existe déjà" };

  const account = await prisma.accountingAccount.create({
    data: { organizationId: user.organizationId, ...parsed.data },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ACCOUNT_CREATED",
    entityType: "AccountingAccount",
    entityId: account.id,
    entityLabel: `${account.accountNumber} - ${account.name}`,
  });

  revalidatePath("/accounting/accounts");
  return { success: true, accountId: account.id };
}

export async function updateAccountingAccountAction(id: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_SETTINGS_UPDATE");

  const parsed = updateAccountingAccountSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const account = await prisma.accountingAccount.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!account) return { success: false, error: "Compte introuvable" };

  await prisma.accountingAccount.update({ where: { id }, data: parsed.data });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ACCOUNT_UPDATED",
    entityType: "AccountingAccount",
    entityId: id,
    entityLabel: account.accountNumber,
  });

  revalidatePath("/accounting/accounts");
  return { success: true };
}

export async function disableAccountingAccountAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_SETTINGS_UPDATE");

  const account = await prisma.accountingAccount.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!account) return { success: false, error: "Compte introuvable" };

  await prisma.accountingAccount.update({ where: { id }, data: { isActive: false } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ACCOUNT_DISABLED",
    entityType: "AccountingAccount",
    entityId: id,
    entityLabel: account.accountNumber,
  });

  revalidatePath("/accounting/accounts");
  return { success: true };
}

export async function exportAccountingAccountsCsvAction(filters?: {
  q?: string;
  type?: string;
  category?: string;
  active?: string;
}) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_EXPORT");

  const accounts = await listAccountingAccountsQuery(user.organizationId, filters);
  const csv = generateAccountsCsv(accounts);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ENTRIES_EXPORTED",
    entityType: "AccountingAccount",
    entityLabel: "Export plan comptable",
  });

  return { success: true, csv, filename: "plan-comptable.csv" };
}
