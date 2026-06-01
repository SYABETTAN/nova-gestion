import { prisma } from "@/lib/prisma";

export type SettingsCompletionStatus = {
  hasDefaultTaxRate: boolean;
  hasDefaultPaymentTerm: boolean;
  hasAccountingMappings: boolean;
  hasDocumentTemplates: boolean;
  isComplete: boolean;
};

export async function getSettingsCompletionStatus(
  organizationId: string,
): Promise<SettingsCompletionStatus> {
  const [defaultTax, defaultTerm, mappings, templates] = await Promise.all([
    prisma.taxRate.findFirst({ where: { organizationId, isDefault: true, isActive: true } }),
    prisma.paymentTerm.findFirst({ where: { organizationId, isDefault: true, isActive: true } }),
    prisma.accountingMapping.count({ where: { organizationId, isActive: true } }),
    prisma.documentTemplate.count({ where: { organizationId, isActive: true, isDefault: true } }),
  ]);

  const status = {
    hasDefaultTaxRate: !!defaultTax,
    hasDefaultPaymentTerm: !!defaultTerm,
    hasAccountingMappings: mappings > 0,
    hasDocumentTemplates: templates > 0,
    isComplete: false,
  };
  status.isComplete =
    status.hasDefaultTaxRate &&
    status.hasDefaultPaymentTerm &&
    status.hasAccountingMappings &&
    status.hasDocumentTemplates;
  return status;
}
