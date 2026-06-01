"use server";

import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  generateAccountingEntriesCsv,
  generateAccountingEntryLinesCsv,
  generateGeneralLedgerCsv,
  generateTrialBalanceCsv,
  generateVatSummaryCsv,
} from "@/lib/csv";
import { accountingEntryFilterSchema, generalLedgerFilterSchema, trialBalanceFilterSchema, vatSummaryFilterSchema } from "@/lib/accounting-validators";
import { getAccountingEntriesForExportQuery } from "@/lib/accounting";
import { getGeneralLedgerQuery } from "@/lib/general-ledger";
import { getTrialBalanceQuery } from "@/lib/trial-balance";
import { getVatSummaryQuery } from "@/lib/vat-summary";

export async function exportAccountingEntriesCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_EXPORT");

  const filters = accountingEntryFilterSchema.parse(searchParams);
  const entries = await getAccountingEntriesForExportQuery(user.organizationId, filters);
  const csv = generateAccountingEntriesCsv(entries);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ENTRIES_EXPORTED",
    entityType: "AccountingEntry",
    entityLabel: "Export écritures CSV",
  });

  return { success: true, csv, filename: "ecritures.csv" };
}

export async function exportAccountingEntryLinesCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_EXPORT");

  const filters = accountingEntryFilterSchema.parse(searchParams);
  const entries = await getAccountingEntriesForExportQuery(user.organizationId, filters);
  const csv = generateAccountingEntryLinesCsv(entries);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_ENTRIES_EXPORTED",
    entityType: "AccountingEntryLine",
    entityLabel: "Export lignes écritures CSV",
  });

  return { success: true, csv, filename: "lignes-ecritures.csv" };
}

export async function exportGeneralLedgerCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_EXPORT");

  const filters = generalLedgerFilterSchema.parse(searchParams);
  const rows = await getGeneralLedgerQuery(user.organizationId, filters);
  const csv = generateGeneralLedgerCsv(rows);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_LEDGER_EXPORTED",
    entityType: "GeneralLedger",
    entityLabel: "Export grand livre CSV",
  });

  return { success: true, csv, filename: "grand-livre.csv" };
}

export async function exportTrialBalanceCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_EXPORT");

  const filters = trialBalanceFilterSchema.parse(searchParams);
  const rows = await getTrialBalanceQuery(user.organizationId, filters);
  const csv = generateTrialBalanceCsv(rows);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_TRIAL_BALANCE_EXPORTED",
    entityType: "TrialBalance",
    entityLabel: "Export balance CSV",
  });

  return { success: true, csv, filename: "balance.csv" };
}

export async function exportVatSummaryCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_EXPORT");

  const filters = vatSummaryFilterSchema.parse(searchParams);
  const summary = await getVatSummaryQuery(user.organizationId, filters);
  const csv = generateVatSummaryCsv(summary.rows);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_VAT_SUMMARY_EXPORTED",
    entityType: "VatSummary",
    entityLabel: "Export synthèse TVA CSV",
  });

  return { success: true, csv, filename: "tva.csv" };
}

export async function getGeneralLedgerAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  const filters = generalLedgerFilterSchema.parse(searchParams);
  return getGeneralLedgerQuery(user.organizationId, filters);
}

export async function getTrialBalanceAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  const filters = trialBalanceFilterSchema.parse(searchParams);
  return getTrialBalanceQuery(user.organizationId, filters);
}

export async function getVatSummaryAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "ACCOUNTING_READ");
  const filters = vatSummaryFilterSchema.parse(searchParams);
  return getVatSummaryQuery(user.organizationId, filters);
}
