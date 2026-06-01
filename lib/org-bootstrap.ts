import type { Prisma, PrismaClient } from "@prisma/client";
import { FEATURE_FLAG_DEFINITIONS } from "@/lib/feature-flags";
import {
  BOOTSTRAP_ACCOUNTS,
  BOOTSTRAP_ACCOUNTING_MAPPINGS,
  BOOTSTRAP_COMMERCIAL_FOOTER,
  BOOTSTRAP_CURRENCIES,
  BOOTSTRAP_DOCUMENT_TEMPLATES,
  BOOTSTRAP_EXPENSE_CATEGORY,
  BOOTSTRAP_INVOICE_FOOTER,
  BOOTSTRAP_JOURNALS,
  BOOTSTRAP_NOTIFICATION_TYPES,
  BOOTSTRAP_NUMBERING_SEQUENCES,
  BOOTSTRAP_PAYMENT_TERMS,
  BOOTSTRAP_TAX_RATES,
} from "@/lib/org-bootstrap-defaults";

type BootstrapClient = Prisma.TransactionClient | PrismaClient;

async function isAlreadyBootstrapped(tx: BootstrapClient, organizationId: string): Promise<boolean> {
  const count = await tx.numberingSequence.count({ where: { organizationId } });
  return count > 0;
}

async function bootstrapNumberingSequences(tx: BootstrapClient, organizationId: string) {
  for (const seq of BOOTSTRAP_NUMBERING_SEQUENCES) {
    await tx.numberingSequence.upsert({
      where: {
        organizationId_type: { organizationId, type: seq.type },
      },
      update: {},
      create: {
        organizationId,
        type: seq.type,
        prefix: seq.prefix,
        nextNumber: seq.nextNumber,
        padding: seq.padding,
        suffix: seq.suffix,
        resetPeriod: seq.resetPeriod,
      },
    });
  }
}

async function bootstrapAccounting(tx: BootstrapClient, organizationId: string) {
  for (const account of BOOTSTRAP_ACCOUNTS) {
    await tx.accountingAccount.upsert({
      where: {
        organizationId_accountNumber: { organizationId, accountNumber: account.accountNumber },
      },
      update: {
        name: account.name,
        type: account.type as never,
        category: account.category as never,
        isSystem: true,
      },
      create: {
        organizationId,
        accountNumber: account.accountNumber,
        name: account.name,
        type: account.type as never,
        category: account.category as never,
        isSystem: true,
        isActive: true,
      },
    });
  }

  for (const journal of BOOTSTRAP_JOURNALS) {
    await tx.accountingJournal.upsert({
      where: { organizationId_code: { organizationId, code: journal.code } },
      update: {
        name: journal.name,
        type: journal.type as never,
        isSystem: true,
      },
      create: {
        organizationId,
        code: journal.code,
        name: journal.name,
        type: journal.type as never,
        isSystem: true,
        isActive: true,
      },
    });
  }
}

async function bootstrapExpenseCategory(tx: BootstrapClient, organizationId: string) {
  const existing = await tx.expenseCategory.findFirst({
    where: { organizationId, name: BOOTSTRAP_EXPENSE_CATEGORY.name },
  });
  if (existing) return existing;

  return tx.expenseCategory.create({
    data: {
      organizationId,
      name: BOOTSTRAP_EXPENSE_CATEGORY.name,
      description: BOOTSTRAP_EXPENSE_CATEGORY.description,
      accountingAccountPlaceholder: BOOTSTRAP_EXPENSE_CATEGORY.accountingAccountPlaceholder,
    },
  });
}

export async function bootstrapOrganizationSettings(
  tx: BootstrapClient,
  organizationId: string,
) {
  for (const t of BOOTSTRAP_TAX_RATES) {
    const existing = await tx.taxRate.findFirst({
      where: { organizationId, name: t.name },
    });
    if (!existing) {
      await tx.taxRate.create({
        data: {
          organizationId,
          name: t.name,
          rate: t.rate,
          type: "type" in t ? t.type : "VAT",
          isDefault: t.isDefault,
        },
      });
    }
  }

  for (const term of BOOTSTRAP_PAYMENT_TERMS) {
    const existing = await tx.paymentTerm.findFirst({
      where: { organizationId, name: term.name },
    });
    if (!existing) {
      await tx.paymentTerm.create({ data: { organizationId, ...term } });
    }
  }

  for (const c of BOOTSTRAP_CURRENCIES) {
    await tx.currencySetting.upsert({
      where: { organizationId_code: { organizationId, code: c.code } },
      update: {},
      create: { organizationId, ...c },
    });
  }

  const existingLocale = await tx.localizationSetting.findFirst({ where: { organizationId } });
  if (!existingLocale) {
    await tx.localizationSetting.create({
      data: { organizationId, locale: "fr-FR", timezone: "Europe/Paris" },
    });
  }

  const expenseCategory = await bootstrapExpenseCategory(tx, organizationId);

  const defaultTerm = await tx.paymentTerm.findFirst({
    where: { organizationId, isDefault: true },
  });
  const defaultTax = await tx.taxRate.findFirst({
    where: { organizationId, isDefault: true },
  });

  const existingCommercial = await tx.commercialPreference.findFirst({ where: { organizationId } });
  if (!existingCommercial) {
    await tx.commercialPreference.create({
      data: {
        organizationId,
        defaultCustomerPaymentTermId: defaultTerm?.id,
        defaultCustomerTaxRateId: defaultTax?.id,
        defaultQuoteFooter: BOOTSTRAP_COMMERCIAL_FOOTER,
      },
    });
  }

  const existingInvoicing = await tx.invoicingPreference.findFirst({ where: { organizationId } });
  if (!existingInvoicing) {
    await tx.invoicingPreference.create({
      data: {
        organizationId,
        defaultInvoicePaymentTermId: defaultTerm?.id,
        defaultInvoiceTaxRateId: defaultTax?.id,
        defaultInvoiceFooter: BOOTSTRAP_INVOICE_FOOTER,
        showSandboxLegalNotice: false,
      },
    });
  }

  const existingSupplier = await tx.supplierPreference.findFirst({ where: { organizationId } });
  if (!existingSupplier) {
    await tx.supplierPreference.create({
      data: {
        organizationId,
        defaultSupplierPaymentTermId: defaultTerm?.id,
        defaultSupplierTaxRateId: defaultTax?.id,
        defaultExpenseCategoryId: expenseCategory.id,
      },
    });
  }

  const journals = await tx.accountingJournal.findMany({ where: { organizationId } });
  const journalId = (code: string) => journals.find((x) => x.code === code)?.id;

  const existingAccountingPref = await tx.accountingPreference.findFirst({ where: { organizationId } });
  if (!existingAccountingPref) {
    await tx.accountingPreference.create({
      data: {
        organizationId,
        defaultSalesJournalId: journalId("VE"),
        defaultPurchaseJournalId: journalId("AC"),
        defaultBankJournalId: journalId("BQ"),
        defaultCashJournalId: journalId("CA"),
        defaultMiscJournalId: journalId("OD"),
        requireBalancedEntriesForValidation: true,
        allowDraftUnbalancedEntries: true,
      },
    });
  }

  for (const m of BOOTSTRAP_ACCOUNTING_MAPPINGS) {
    const account = await tx.accountingAccount.findFirst({
      where: { organizationId, accountNumber: m.accountNumber },
    });
    if (!account) continue;

    const existingMapping = await tx.accountingMapping.findFirst({
      where: { organizationId, type: m.type as never },
    });
    if (!existingMapping) {
      await tx.accountingMapping.create({
        data: {
          organizationId,
          type: m.type as never,
          label: m.label,
          accountId: account.id,
          isDefault: true,
        },
      });
    }
  }

  for (const type of BOOTSTRAP_NOTIFICATION_TYPES) {
    const existing = await tx.notificationPreference.findFirst({
      where: { organizationId, type },
    });
    if (!existing) {
      await tx.notificationPreference.create({
        data: { organizationId, type, enabled: true, channel: "IN_APP" },
      });
    }
  }

  for (const def of FEATURE_FLAG_DEFINITIONS) {
    await tx.featureFlag.upsert({
      where: { organizationId_key: { organizationId, key: def.key } },
      update: {},
      create: {
        organizationId,
        key: def.key,
        name: def.name,
        description: def.description,
        enabled: true,
        isSystem: def.isSystem ?? false,
      },
    });
  }
}

export async function bootstrapOrganizationDocuments(
  tx: BootstrapClient,
  organizationId: string,
) {
  for (const tpl of BOOTSTRAP_DOCUMENT_TEMPLATES) {
    const existing = await tx.documentTemplate.findFirst({
      where: { organizationId, type: tpl.type, name: tpl.name },
    });
    if (existing) continue;

    await tx.documentTemplate.create({
      data: {
        organizationId,
        type: tpl.type,
        name: tpl.name,
        description: tpl.description,
        headerText: tpl.headerText,
        footerText: tpl.footerText,
        primaryColor: "#2563eb",
        showLogo: true,
        showSandboxBadge: false,
        isDefault: tpl.isDefault,
        isActive: true,
      },
    });
  }
}

/**
 * Initialise tous les paramètres système requis pour une nouvelle organisation.
 * Transactionnel, idempotent (no-op si déjà bootstrappé), multi-tenant safe.
 */
export async function bootstrapOrganization(
  tx: BootstrapClient,
  organizationId: string,
): Promise<void> {
  if (await isAlreadyBootstrapped(tx, organizationId)) {
    return;
  }

  await bootstrapNumberingSequences(tx, organizationId);
  await bootstrapAccounting(tx, organizationId);
  await bootstrapOrganizationSettings(tx, organizationId);
  await bootstrapOrganizationDocuments(tx, organizationId);
}
