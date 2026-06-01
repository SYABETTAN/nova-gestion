"use server";

import { revalidatePath } from "next/cache";
import type { AccountingMappingType, NotificationType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { getSettingsCompletionStatus } from "@/lib/settings";
import { slugifyKey } from "@/lib/settings-utils";
import {
  createAccountingMappingSchema,
  createCurrencySchema,
  createCustomFieldSchema,
  createPaymentTermSchema,
  createTaxRateSchema,
  updateAccountingMappingSchema,
  updateAccountingPreferenceSchema,
  updateCommercialPreferenceSchema,
  updateCurrencySchema,
  updateFeatureFlagSchema,
  updateInvoicingPreferenceSchema,
  updateLocalizationSchema,
  updateNotificationPreferenceSchema,
  updatePaymentTermSchema,
  updateSupplierPreferenceSchema,
  updateTaxRateSchema,
} from "@/lib/settings-validators";
import { canDisableFeatureFlag } from "@/lib/feature-flags";

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/settings", "layout");
}

export async function getSettingsOverviewAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const completion = await getSettingsCompletionStatus(user.organizationId);
  return { completion };
}

// --- Tax rates ---
export async function listTaxRatesAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.taxRate.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ isDefault: "desc" }, { rate: "desc" }],
  });
}

export async function createTaxRateAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = createTaxRateSchema.parse(input);
  const rate = await prisma.taxRate.create({
    data: { organizationId: user.organizationId, ...data, type: data.type as never },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TAX_RATE_CREATED",
    entityType: "TaxRate",
    entityId: rate.id,
    entityLabel: rate.name,
  });
  revalidateSettings();
  return { success: true as const, rate };
}

export async function updateTaxRateAction(id: string, input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateTaxRateSchema.parse(input);
  const rate = await prisma.taxRate.update({ where: { id, organizationId: user.organizationId }, data });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TAX_RATE_UPDATED",
    entityType: "TaxRate",
    entityId: rate.id,
    entityLabel: rate.name,
  });
  revalidateSettings();
  return { success: true as const };
}

export async function disableTaxRateAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  await prisma.taxRate.update({
    where: { id, organizationId: user.organizationId },
    data: { isActive: false, isDefault: false },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TAX_RATE_DISABLED",
    entityType: "TaxRate",
    entityId: id,
  });
  revalidateSettings();
  return { success: true as const };
}

export async function setDefaultTaxRateAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  await prisma.taxRate.updateMany({
    where: { organizationId: user.organizationId },
    data: { isDefault: false },
  });
  await prisma.taxRate.update({
    where: { id, organizationId: user.organizationId },
    data: { isDefault: true, isActive: true },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TAX_RATE_SET_DEFAULT",
    entityType: "TaxRate",
    entityId: id,
  });
  revalidateSettings();
  return { success: true as const };
}

export async function listActiveTaxRatesAction() {
  const user = await requireAuth();
  return prisma.taxRate.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    orderBy: { rate: "desc" },
  });
}

// --- Payment terms ---
export async function listPaymentTermsAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.paymentTerm.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { days: "asc" },
  });
}

export async function createPaymentTermAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = createPaymentTermSchema.parse(input);
  const term = await prisma.paymentTerm.create({
    data: { organizationId: user.organizationId, ...data },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_TERM_CREATED",
    entityType: "PaymentTerm",
    entityId: term.id,
    entityLabel: term.name,
  });
  revalidateSettings();
  return { success: true as const, term };
}

export async function updatePaymentTermAction(id: string, input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updatePaymentTermSchema.parse(input);
  const term = await prisma.paymentTerm.update({
    where: { id, organizationId: user.organizationId },
    data,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_TERM_UPDATED",
    entityType: "PaymentTerm",
    entityId: term.id,
    entityLabel: term.name,
  });
  revalidateSettings();
  return { success: true as const };
}

export async function disablePaymentTermAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  await prisma.paymentTerm.update({
    where: { id, organizationId: user.organizationId },
    data: { isActive: false, isDefault: false },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_TERM_DISABLED",
    entityType: "PaymentTerm",
    entityId: id,
  });
  revalidateSettings();
  return { success: true as const };
}

export async function setDefaultPaymentTermAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  await prisma.paymentTerm.updateMany({
    where: { organizationId: user.organizationId },
    data: { isDefault: false },
  });
  await prisma.paymentTerm.update({
    where: { id, organizationId: user.organizationId },
    data: { isDefault: true, isActive: true },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYMENT_TERM_SET_DEFAULT",
    entityType: "PaymentTerm",
    entityId: id,
  });
  revalidateSettings();
  return { success: true as const };
}

// --- Currencies ---
export async function listCurrenciesAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.currencySetting.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { code: "asc" },
  });
}

export async function updateCurrencyAction(id: string, input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateCurrencySchema.parse(input);
  const currency = await prisma.currencySetting.update({
    where: { id, organizationId: user.organizationId },
    data,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CURRENCY_UPDATED",
    entityType: "CurrencySetting",
    entityId: currency.id,
    entityLabel: currency.code,
  });
  revalidateSettings();
  return { success: true as const };
}

export async function setDefaultCurrencyAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  await prisma.currencySetting.updateMany({
    where: { organizationId: user.organizationId },
    data: { isDefault: false },
  });
  await prisma.currencySetting.update({
    where: { id, organizationId: user.organizationId },
    data: { isDefault: true, isActive: true },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CURRENCY_SET_DEFAULT",
    entityType: "CurrencySetting",
    entityId: id,
  });
  revalidateSettings();
  return { success: true as const };
}

// --- Localization ---
export async function getLocalizationAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  let loc = await prisma.localizationSetting.findUnique({
    where: { organizationId: user.organizationId },
  });
  if (!loc) {
    loc = await prisma.localizationSetting.create({
      data: { organizationId: user.organizationId },
    });
  }
  return loc;
}

export async function updateLocalizationAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateLocalizationSchema.parse(input);
  const loc = await prisma.localizationSetting.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId, ...data },
    update: data,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LOCALIZATION_SETTINGS_UPDATED",
    entityType: "LocalizationSetting",
    entityId: loc.id,
  });
  revalidateSettings();
  return { success: true as const };
}

// --- Preferences ---
export async function getCommercialPreferenceAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.commercialPreference.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId },
    update: {},
  });
}

export async function updateCommercialPreferenceAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateCommercialPreferenceSchema.parse(input);
  await prisma.commercialPreference.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId, ...data },
    update: data,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "COMMERCIAL_PREFERENCES_UPDATED",
    entityType: "CommercialPreference",
    entityLabel: "Préférences commerciales",
  });
  revalidateSettings();
  return { success: true as const };
}

export async function getInvoicingPreferenceAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.invoicingPreference.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId },
    update: {},
  });
}

export async function updateInvoicingPreferenceAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateInvoicingPreferenceSchema.parse(input);
  await prisma.invoicingPreference.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId, ...data },
    update: data,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICING_PREFERENCES_UPDATED",
    entityType: "InvoicingPreference",
    entityLabel: "Préférences facturation",
  });
  revalidateSettings();
  return { success: true as const };
}

export async function getSupplierPreferenceAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.supplierPreference.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId },
    update: {},
  });
}

export async function updateSupplierPreferenceAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateSupplierPreferenceSchema.parse(input);
  await prisma.supplierPreference.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId, ...data },
    update: data,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_PREFERENCES_UPDATED",
    entityType: "SupplierPreference",
    entityLabel: "Préférences fournisseurs",
  });
  revalidateSettings();
  return { success: true as const };
}

export async function getAccountingPreferenceAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.accountingPreference.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId },
    update: {},
  });
}

export async function updateAccountingPreferenceAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateAccountingPreferenceSchema.parse(input);
  await prisma.accountingPreference.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId, ...data },
    update: data,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_PREFERENCES_UPDATED",
    entityType: "AccountingPreference",
    entityLabel: "Préférences comptabilité",
  });
  revalidateSettings();
  return { success: true as const };
}

// --- Accounting mapping ---
export async function listAccountingMappingsAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const mappings = await prisma.accountingMapping.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { type: "asc" },
  });
  const accounts = await prisma.accountingAccount.findMany({
    where: { organizationId: user.organizationId },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  return mappings.map((m) => ({
    ...m,
    account: accountMap.get(m.accountId),
  }));
}

export async function createAccountingMappingAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = createAccountingMappingSchema.parse(input);
  const mapping = await prisma.accountingMapping.create({
    data: {
      organizationId: user.organizationId,
      type: data.type as AccountingMappingType,
      label: data.label,
      accountId: data.accountId,
      taxRateId: data.taxRateId,
      expenseCategoryId: data.expenseCategoryId,
      itemCategoryId: data.itemCategoryId,
      supplierCategoryId: data.supplierCategoryId,
    },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_MAPPING_CREATED",
    entityType: "AccountingMapping",
    entityId: mapping.id,
    entityLabel: mapping.label,
  });
  revalidateSettings();
  return { success: true as const };
}

export async function disableAccountingMappingAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  await prisma.accountingMapping.update({
    where: { id, organizationId: user.organizationId },
    data: { isActive: false, isDefault: false },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ACCOUNTING_MAPPING_DISABLED",
    entityType: "AccountingMapping",
    entityId: id,
  });
  revalidateSettings();
  return { success: true as const };
}

// --- Notifications ---
export async function listNotificationPreferencesAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.notificationPreference.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { type: "asc" },
  });
}

export async function updateNotificationPreferenceAction(
  id: string,
  input: Record<string, unknown>,
) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateNotificationPreferenceSchema.parse(input);
  await prisma.notificationPreference.update({
    where: { id, organizationId: user.organizationId },
    data,
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "NOTIFICATION_PREFERENCES_UPDATED",
    entityType: "NotificationPreference",
    entityId: id,
  });
  revalidateSettings();
  return { success: true as const };
}

// --- Feature flags ---
export async function listFeatureFlagsAction() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.featureFlag.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
}

export async function updateFeatureFlagAction(id: string, input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = updateFeatureFlagSchema.parse(input);
  const flag = await prisma.featureFlag.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!flag) throw new Error("Feature flag introuvable");
  if (!canDisableFeatureFlag(flag.key) && !data.enabled) {
    throw new Error("Ce module ne peut pas être désactivé");
  }
  await prisma.featureFlag.update({
    where: { id },
    data: { enabled: data.enabled },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "FEATURE_FLAG_UPDATED",
    entityType: "FeatureFlag",
    entityId: id,
    entityLabel: flag.name,
    newValues: { enabled: data.enabled },
  });
  revalidateSettings();
  return { success: true as const };
}

// --- Custom fields ---
export async function listCustomFieldsAction(entityType?: string) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  return prisma.customFieldDefinition.findMany({
    where: {
      organizationId: user.organizationId,
      ...(entityType ? { entityType: entityType as never } : {}),
    },
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
  });
}

export async function createCustomFieldAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  const data = createCustomFieldSchema.parse(input);
  const key = data.key || slugifyKey(data.label);
  const field = await prisma.customFieldDefinition.create({
    data: {
      organizationId: user.organizationId,
      entityType: data.entityType as never,
      key,
      label: data.label,
      fieldType: data.fieldType,
      options: data.options,
      isRequired: data.isRequired,
    },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOM_FIELD_CREATED",
    entityType: "CustomFieldDefinition",
    entityId: field.id,
    entityLabel: field.label,
  });
  revalidateSettings();
  return { success: true as const, field };
}

export async function disableCustomFieldAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_UPDATE");
  await prisma.customFieldDefinition.update({
    where: { id, organizationId: user.organizationId },
    data: { isActive: false },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOM_FIELD_DISABLED",
    entityType: "CustomFieldDefinition",
    entityId: id,
  });
  revalidateSettings();
  return { success: true as const };
}


export async function getSettingsFormOptionsAction() {
  const user = await requireAuth();
  const orgId = user.organizationId;
  const [paymentTerms, taxRates, expenseCategories, journals, accounts] = await Promise.all([
    prisma.paymentTerm.findMany({ where: { organizationId: orgId, isActive: true } }),
    prisma.taxRate.findMany({ where: { organizationId: orgId, isActive: true } }),
    prisma.expenseCategory.findMany({ where: { organizationId: orgId, isActive: true } }),
    prisma.accountingJournal.findMany({ where: { organizationId: orgId, isActive: true } }),
    prisma.accountingAccount.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { accountNumber: "asc" },
    }),
  ]);
  return { paymentTerms, taxRates, expenseCategories, journals, accounts };
}
