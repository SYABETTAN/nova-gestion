import type { DocumentType, ExportFormat, ExportStatus, ExportType, PrismaClient } from "@prisma/client";
import { SEED_PLACEHOLDER_PDF, seedPutFile } from "@/lib/seed/storage-seed";

const TEMPLATE_DEFS: {
  type: DocumentType;
  name: string;
  description: string;
  headerText: string;
  footerText: string;
  isDefault: boolean;
}[] = [
  {
    type: "QUOTE",
    name: "Devis standard",
    description: "Modèle de devis commercial",
    headerText: "{{organizationName}} — Devis {{documentNumber}}",
    footerText: "Document exemple — sans valeur contractuelle.",
    isDefault: true,
  },
  {
    type: "INVOICE",
    name: "Facture standard",
    description: "Modèle de facture client",
    headerText: "{{organizationName}} — Facture {{documentNumber}}",
    footerText: "Document généré par Joey & Joey.",
    isDefault: true,
  },
  {
    type: "CREDIT_NOTE",
    name: "Avoir standard",
    description: "Modèle d'avoir client",
    headerText: "{{organizationName}} — Avoir {{documentNumber}}",
    footerText: "Avoir exemple — non certifié.",
    isDefault: true,
  },
  {
    type: "PAYMENT_RECEIPT",
    name: "Reçu de paiement",
    description: "Accusé de réception de paiement",
    headerText: "Reçu {{documentNumber}} — {{customerName}}",
    footerText: "Reçu fictif.",
    isDefault: true,
  },
  {
    type: "REMINDER",
    name: "Relance client",
    description: "Lettre de relance",
    headerText: "Relance — {{documentNumber}}",
    footerText: "Relance simulée.",
    isDefault: true,
  },
  {
    type: "SUPPLIER_INVOICE",
    name: "Facture fournisseur",
    description: "Facture fournisseur reçue",
    headerText: "{{supplierName}} — {{documentNumber}}",
    footerText: "Pièce fournisseur fictive.",
    isDefault: true,
  },
  {
    type: "ACCOUNTING_EXPORT",
    name: "Export comptable",
    description: "En-tête exports comptables",
    headerText: "{{organizationName}} — Export comptable",
    footerText: "Indicateurs non certifiés.",
    isDefault: true,
  },
];

export async function cleanupExportsDocumentsModule(prisma: PrismaClient, organizationId: string) {
  await prisma.exportJob.deleteMany({ where: { organizationId } });
  await prisma.document.deleteMany({ where: { organizationId } });
  await prisma.documentTemplate.deleteMany({ where: { organizationId } });
}

export async function seedExportsDocuments(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
) {
  await cleanupExportsDocumentsModule(prisma, organizationId);

  for (const tpl of TEMPLATE_DEFS) {
    await prisma.documentTemplate.create({
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

  const docTypes: { type: DocumentType; prefix: string; count: number; mimeType: string }[] = [
    { type: "QUOTE", prefix: "devis", count: 8, mimeType: "application/pdf" },
    { type: "INVOICE", prefix: "facture", count: 8, mimeType: "application/pdf" },
    { type: "PAYMENT_RECEIPT", prefix: "recu", count: 4, mimeType: "application/pdf" },
    { type: "REMINDER", prefix: "relance", count: 4, mimeType: "application/pdf" },
    { type: "SUPPLIER_INVOICE", prefix: "facture-fournisseur", count: 6, mimeType: "application/pdf" },
    { type: "ACCOUNTING_EXPORT", prefix: "export-compta", count: 5, mimeType: "text/csv" },
    { type: "DASHBOARD_EXPORT", prefix: "export-dashboard", count: 5, mimeType: "text/csv" },
  ];

  let docIndex = 0;
  for (const group of docTypes) {
    for (let i = 1; i <= group.count; i++) {
      docIndex += 1;
      const fileName = `${group.prefix}-${String(i).padStart(3, "0")}.${group.mimeType.includes("pdf") ? "pdf" : "csv"}`;
      const body = group.mimeType.includes("pdf")
        ? SEED_PLACEHOLDER_PDF
        : Buffer.from("colonne1;colonne2\nvaleur1;valeur2\n", "utf-8");
      const stored = await seedPutFile({
        organizationId,
        category: "seed-documents",
        fileName,
        body,
        mimeType: group.mimeType,
      });
      await prisma.document.create({
        data: {
          organizationId,
          type: group.type,
          status: i % 5 === 0 ? "ARCHIVED" : "GENERATED",
          title: `${group.prefix.toUpperCase()} ${i}`,
          description: "Document d'exemple",
          fileName,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
          mimeType: group.mimeType,
          sizeBytes: stored.sizeBytes,
          generatedById: userId,
          generatedAt: new Date(Date.now() - docIndex * 86400000),
        },
      });
    }
  }

  const exportTypes: ExportType[] = [
    "CUSTOMERS",
    "INVOICES",
    "PAYMENTS",
    "SUPPLIERS",
    "ACCOUNTING_ENTRIES",
    "DASHBOARD_KPIS",
  ];
  const statuses: ExportStatus[] = ["COMPLETED", "COMPLETED", "COMPLETED", "FAILED", "PENDING"];

  for (let i = 0; i < 30; i++) {
    const type = exportTypes[i % exportTypes.length];
    const format: ExportFormat = i % 4 === 0 ? "JSON" : "CSV";
    const status = statuses[i % statuses.length];
    const createdAt = new Date(Date.now() - i * 3600000);
    const fileName = `export-${type.toLowerCase()}-${createdAt.toISOString().slice(0, 10)}.${format === "JSON" ? "json" : "csv"}`;

    await prisma.exportJob.create({
      data: {
        organizationId,
        type,
        format,
        status,
        fileName: status === "COMPLETED" ? fileName : null,
        fileUrl: null,
        filters: JSON.stringify({ environment: "development" }),
        rowCount: status === "COMPLETED" ? 20 + i : null,
        errorMessage: status === "FAILED" ? "Erreur simulée" : null,
        requestedById: userId,
        startedAt: createdAt,
        completedAt: status !== "PENDING" ? new Date(createdAt.getTime() + 2000) : null,
        createdAt,
      },
    });
  }
}
