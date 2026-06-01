import type { PrismaClient } from "@prisma/client";
import { bootstrapOrganizationSettings } from "@/lib/org-bootstrap";

export async function cleanupSettingsModule(prisma: PrismaClient, organizationId: string) {
  await prisma.customFieldDefinition.deleteMany({ where: { organizationId } });
  await prisma.featureFlag.deleteMany({ where: { organizationId } });
  await prisma.notificationPreference.deleteMany({ where: { organizationId } });
  await prisma.accountingMapping.deleteMany({ where: { organizationId } });
  await prisma.accountingPreference.deleteMany({ where: { organizationId } });
  await prisma.supplierPreference.deleteMany({ where: { organizationId } });
  await prisma.invoicingPreference.deleteMany({ where: { organizationId } });
  await prisma.commercialPreference.deleteMany({ where: { organizationId } });
  await prisma.localizationSetting.deleteMany({ where: { organizationId } });
  await prisma.currencySetting.deleteMany({ where: { organizationId } });
  await prisma.paymentTerm.deleteMany({ where: { organizationId } });
  await prisma.taxRate.deleteMany({ where: { organizationId } });
  await prisma.appSetting.deleteMany({ where: { organizationId } });
}

export async function seedSettings(prisma: PrismaClient, organizationId: string, _userId: string) {
  await cleanupSettingsModule(prisma, organizationId);
  await bootstrapOrganizationSettings(prisma, organizationId);

  const customFields = [
    { entityType: "CUSTOMER" as const, label: "Source d'acquisition", key: "source_acquisition", fieldType: "SELECT" as const, options: JSON.stringify(["Site web", "Salon", "Recommandation"]) },
    { entityType: "CUSTOMER" as const, label: "Segment commercial", key: "segment_commercial", fieldType: "TEXT" as const },
    { entityType: "SUPPLIER" as const, label: "Type de contrat", key: "type_contrat", fieldType: "TEXT" as const },
    { entityType: "ITEM" as const, label: "Famille interne", key: "famille_interne", fieldType: "TEXT" as const },
    { entityType: "INVOICE" as const, label: "Référence interne client", key: "ref_interne_client", fieldType: "TEXT" as const },
  ];
  for (const cf of customFields) {
    await prisma.customFieldDefinition.create({ data: { organizationId, ...cf } });
  }
}
