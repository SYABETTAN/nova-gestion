import fs from "fs/promises";
import path from "path";
import type { CustomerAddressType, Prisma, PrismaClient, SupplierInvoicePaymentStatus } from "@prisma/client";
import { ItemStatus, ItemType } from "@prisma/client";
import { toDbDecimal } from "@/lib/money";
import { mapMoneyFieldsToDb, SUPPLIER_INVOICE_LINE_MONEY_FIELDS, SUPPLIER_INVOICE_TOTAL_FIELDS } from "@/lib/money-db";
import { calculateSupplierInvoiceTotals } from "@/lib/supplier-invoice-calculations";
import { computeItemPricing } from "@/lib/pricing";
import { seedPutFile } from "@/lib/seed/storage-seed";
import {
  ESTHER_REAL_CUSTOMERS,
  ESTHER_REAL_DOCUMENTS,
  ESTHER_REAL_PRODUCTS,
  ESTHER_REAL_SUPPLIER_INVOICES,
  ESTHER_REAL_SUPPLIERS,
} from "@/lib/esther-real-data/catalog";
import type {
  EstherCustomerSeed,
  EstherImportReport,
  EstherProductSeed,
  EstherSupplierInvoiceSeed,
  EstherSupplierSeed,
} from "@/lib/esther-real-data/types";

const TEXTILE_CATEGORY = "Textile";
const PIECE_UNIT = { name: "Pièce", symbol: "pce" };

function toCustomerAddressType(type: EstherCustomerSeed["addresses"][number]["type"]): CustomerAddressType {
  if (type === "HEADQUARTERS") return "OTHER";
  return type;
}

export function resolveEstherDataDir(customDir?: string): string {
  return path.resolve(customDir ?? process.env.ESTHER_REAL_DATA_DIR ?? path.join(process.cwd(), "data/esther-real"));
}

export function customerNumberFromSeed(seed: EstherCustomerSeed): string {
  if (seed.siren) return `ESTHER-${seed.siren}`;
  return `ESTHER-${seed.importKey.replace(/^customer-/, "").toUpperCase()}`;
}

export function supplierNumberFromSeed(seed: EstherSupplierSeed): string {
  if (seed.vatNumber) return `ESTHER-${seed.vatNumber.replace(/^FR/i, "")}`;
  if (seed.siret) return `ESTHER-${seed.siret.slice(0, 9)}`;
  return `ESTHER-${seed.importKey.replace(/^supplier-/, "").toUpperCase()}`;
}

export function itemNumberFromSku(sku: string): string {
  return `ART-${sku}`;
}

export function supplierInvoiceNumberFromSeed(seed: EstherSupplierInvoiceSeed): string {
  return `ESTHER-${seed.supplierReference}`;
}

export function buildImportNotes(seed: {
  notes?: string;
  sourceDocument?: string;
  metadata?: Record<string, string>;
}): string | undefined {
  const parts: string[] = [];
  if (seed.notes) parts.push(seed.notes);
  if (seed.sourceDocument) parts.push(`Source: ${seed.sourceDocument}`);
  if (seed.metadata && Object.keys(seed.metadata).length > 0) {
    parts.push(`Metadata: ${JSON.stringify(seed.metadata)}`);
  }
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export async function resolveOrganizationId(
  prisma: PrismaClient,
  options?: { organizationId?: string; organizationSlug?: string },
): Promise<{ id: string; name: string }> {
  const explicitId = options?.organizationId ?? process.env.ORGANIZATION_ID;
  if (explicitId) {
    const org = await prisma.organization.findUnique({ where: { id: explicitId } });
    if (!org) throw new Error(`Organisation introuvable: ${explicitId}`);
    return { id: org.id, name: org.name };
  }

  const slug = options?.organizationSlug ?? process.env.ORGANIZATION_SLUG ?? "nova-gestion";
  const bySlug = await prisma.organization.findUnique({ where: { slug } });
  if (bySlug) return { id: bySlug.id, name: bySlug.name };

  const byName = await prisma.organization.findFirst({
    where: { name: { contains: "Esther", mode: "insensitive" } },
  });
  if (byName) return { id: byName.id, name: byName.name };

  const first = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!first) throw new Error("Aucune organisation en base — créez-en une avec npm run org:create");
  return { id: first.id, name: first.name };
}

async function ensureTextileCategory(prisma: PrismaClient, organizationId: string) {
  return prisma.itemCategory.upsert({
    where: { organizationId_name: { organizationId, name: TEXTILE_CATEGORY } },
    update: { isActive: true },
    create: {
      organizationId,
      name: TEXTILE_CATEGORY,
      description: "Articles textile importés — données réelles Esther",
      color: "#db2777",
      sortOrder: 1,
    },
  });
}

async function ensurePieceUnit(prisma: PrismaClient, organizationId: string) {
  const existing = await prisma.itemUnit.findFirst({
    where: { organizationId, symbol: PIECE_UNIT.symbol },
  });
  if (existing) return existing;
  return prisma.itemUnit.create({
    data: {
      organizationId,
      name: PIECE_UNIT.name,
      symbol: PIECE_UNIT.symbol,
      isDefault: false,
    },
  });
}

async function findCustomerId(
  prisma: PrismaClient,
  organizationId: string,
  seed: EstherCustomerSeed,
): Promise<string | null> {
  if (seed.siret) {
    const bySiret = await prisma.customer.findFirst({
      where: { organizationId, siret: seed.siret },
      select: { id: true },
    });
    if (bySiret) return bySiret.id;
  }
  if (seed.siren) {
    const bySiren = await prisma.customer.findFirst({
      where: {
        organizationId,
        OR: [
          { siret: { startsWith: seed.siren } },
          { notes: { contains: seed.siren } },
        ],
      },
      select: { id: true },
    });
    if (bySiren) return bySiren.id;
  }
  const byName = await prisma.customer.findFirst({
    where: { organizationId, name: seed.name },
    select: { id: true },
  });
  return byName?.id ?? null;
}

async function upsertCustomer(
  prisma: PrismaClient,
  organizationId: string,
  seed: EstherCustomerSeed,
): Promise<{ id: string; action: "created" | "updated" }> {
  const existingId = await findCustomerId(prisma, organizationId, seed);
  const customerNumber = customerNumberFromSeed(seed);
  const notes = buildImportNotes(seed);

  const data = {
    type: "COMPANY" as const,
    status: "ACTIVE" as const,
    name: seed.name,
    legalName: seed.legalName ?? seed.name,
    displayName: seed.displayName,
    email: seed.email,
    phone: seed.phone,
    website: seed.website,
    siret: seed.siret,
    vatNumber: seed.vatNumber,
    legalForm: seed.legalForm,
    industry: seed.industry,
    notes,
  };

  let customerId: string;
  let action: "created" | "updated";

  if (existingId) {
    await prisma.customer.update({ where: { id: existingId }, data });
    customerId = existingId;
    action = "updated";
  } else {
    const created = await prisma.customer.create({
      data: { organizationId, customerNumber, ...data },
    });
    customerId = created.id;
    action = "created";
  }

  for (const [index, address] of seed.addresses.entries()) {
    const existingAddress = await prisma.customerAddress.findFirst({
      where: {
        organizationId,
        customerId,
        addressLine1: address.addressLine1,
        postalCode: address.postalCode,
        city: address.city,
      },
    });
    if (existingAddress) {
      await prisma.customerAddress.update({
        where: { id: existingAddress.id },
        data: {
          type: toCustomerAddressType(address.type),
          label: address.label,
          addressLine2: address.addressLine2,
          country: address.country ?? "FR",
          isDefault: address.isDefault ?? index === 0,
        },
      });
    } else {
      await prisma.customerAddress.create({
        data: {
          organizationId,
          customerId,
          type: toCustomerAddressType(address.type),
          label: address.label,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          postalCode: address.postalCode,
          city: address.city,
          country: address.country ?? "FR",
          isDefault: address.isDefault ?? index === 0,
        },
      });
    }
  }

  if (seed.contacts?.length) {
    for (const contact of seed.contacts) {
      const existingContact = await prisma.customerContact.findFirst({
        where: {
          organizationId,
          customerId,
          firstName: contact.firstName,
          lastName: contact.lastName,
        },
      });
      if (existingContact) {
        await prisma.customerContact.update({
          where: { id: existingContact.id },
          data: contact,
        });
      } else {
        await prisma.customerContact.create({
          data: { organizationId, customerId, ...contact },
        });
      }
    }
  }

  return { id: customerId, action };
}

async function findSupplierId(
  prisma: PrismaClient,
  organizationId: string,
  seed: EstherSupplierSeed,
): Promise<string | null> {
  if (seed.vatNumber) {
    const byVat = await prisma.supplier.findFirst({
      where: { organizationId, vatNumber: seed.vatNumber },
      select: { id: true },
    });
    if (byVat) return byVat.id;
  }
  if (seed.siret) {
    const bySiret = await prisma.supplier.findFirst({
      where: { organizationId, siret: seed.siret },
      select: { id: true },
    });
    if (bySiret) return bySiret.id;
  }
  const byName = await prisma.supplier.findFirst({
    where: { organizationId, name: seed.name },
    select: { id: true },
  });
  return byName?.id ?? null;
}

async function upsertSupplier(
  prisma: PrismaClient,
  organizationId: string,
  seed: EstherSupplierSeed,
): Promise<{ id: string; action: "created" | "updated" }> {
  const existingId = await findSupplierId(prisma, organizationId, seed);
  const supplierNumber = supplierNumberFromSeed(seed);
  const notes = buildImportNotes(seed);

  const data = {
    type: "COMPANY" as const,
    status: "ACTIVE" as const,
    name: seed.name,
    legalName: seed.legalName ?? seed.name,
    email: seed.email,
    phone: seed.phone,
    siret: seed.siret,
    vatNumber: seed.vatNumber,
    legalForm: seed.legalForm,
    notes,
    isPreferred: seed.importKey === "supplier-msi",
  };

  let supplierId: string;
  let action: "created" | "updated";

  if (existingId) {
    await prisma.supplier.update({ where: { id: existingId }, data });
    supplierId = existingId;
    action = "updated";
  } else {
    const created = await prisma.supplier.create({
      data: { organizationId, supplierNumber, ...data },
    });
    supplierId = created.id;
    action = "created";
  }

  for (const [index, address] of seed.addresses.entries()) {
    const existingAddress = await prisma.supplierAddress.findFirst({
      where: {
        organizationId,
        supplierId,
        addressLine1: address.addressLine1,
        postalCode: address.postalCode,
        city: address.city,
      },
    });
    if (existingAddress) {
      await prisma.supplierAddress.update({
        where: { id: existingAddress.id },
        data: {
          type: toCustomerAddressType(address.type),
          label: address.label,
          addressLine2: address.addressLine2,
          country: address.country ?? "FR",
          isDefault: address.isDefault ?? index === 0,
        },
      });
    } else {
      await prisma.supplierAddress.create({
        data: {
          organizationId,
          supplierId,
          type: address.type,
          label: address.label,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          postalCode: address.postalCode,
          city: address.city,
          country: address.country ?? "FR",
          isDefault: address.isDefault ?? index === 0,
        },
      });
    }
  }

  if (seed.bankAccount) {
    const existingBank = await prisma.supplierBankAccount.findFirst({
      where: { organizationId, supplierId, iban: seed.bankAccount.iban },
    });
    if (existingBank) {
      await prisma.supplierBankAccount.update({
        where: { id: existingBank.id },
        data: {
          label: seed.bankAccount.label,
          bic: seed.bankAccount.bic,
          bankName: seed.bankAccount.bankName,
          accountHolder: seed.bankAccount.accountHolder,
          isDefault: true,
        },
      });
    } else {
      await prisma.supplierBankAccount.create({
        data: {
          organizationId,
          supplierId,
          label: seed.bankAccount.label,
          iban: seed.bankAccount.iban,
          bic: seed.bankAccount.bic,
          bankName: seed.bankAccount.bankName,
          accountHolder: seed.bankAccount.accountHolder,
          isDefault: true,
        },
      });
    }
  }

  return { id: supplierId, action };
}

async function upsertProduct(
  prisma: PrismaClient,
  organizationId: string,
  seed: EstherProductSeed,
  categoryId: string,
  unitId: string,
  supplierIds: Map<string, string>,
): Promise<{ id: string; action: "created" | "updated" }> {
  const existing = await prisma.item.findFirst({
    where: { organizationId, sku: seed.sku },
    select: { id: true },
  });

  const purchaseHT = seed.purchasePriceExcludingTax ?? 0;
  const saleHT = purchaseHT > 0 ? Math.round(purchaseHT * 1.35 * 100) / 100 : 0;
  const vatRate = seed.defaultVatRate ?? 20;
  const pricing = computeItemPricing({
    salePriceExcludingTax: saleHT,
    purchasePriceExcludingTax: purchaseHT,
    defaultVatRate: vatRate,
  });

  const supplierId = seed.supplierImportKey ? supplierIds.get(seed.supplierImportKey) : undefined;
  const notes = [
    seed.notes,
    seed.sourceDocument ? `Source: ${seed.sourceDocument}` : undefined,
    seed.composition ? `Composition: ${seed.composition}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const itemData: Prisma.ItemUncheckedCreateInput = {
    organizationId,
    type: ItemType.PRODUCT,
    status: ItemStatus.ACTIVE,
    itemNumber: itemNumberFromSku(seed.sku),
    sku: seed.sku,
    name: seed.name,
    description: seed.description,
    shortDescription: seed.shortDescription ?? seed.name,
    categoryId,
    supplierId: supplierId ?? null,
    unitId,
    defaultVatRate: toDbDecimal(vatRate),
    salePriceExcludingTax: toDbDecimal(saleHT),
    salePriceIncludingTax: toDbDecimal(pricing.salePriceIncludingTax),
    purchasePriceExcludingTax: toDbDecimal(purchaseHT),
    marginAmount: toDbDecimal(pricing.marginAmount),
    marginRate: toDbDecimal(pricing.marginRate),
    currency: "EUR",
    isStockable: true,
    notes: notes || undefined,
  };

  if (existing) {
    const { organizationId: _org, ...updateData } = itemData;
    await prisma.item.update({ where: { id: existing.id }, data: updateData });
    return { id: existing.id, action: "updated" };
  }

  const created = await prisma.item.create({ data: itemData });
  return { id: created.id, action: "created" };
}

async function upsertSupplierInvoice(
  prisma: PrismaClient,
  organizationId: string,
  seed: EstherSupplierInvoiceSeed,
  supplierIds: Map<string, string>,
  warnings: string[],
): Promise<{ id: string; action: "created" | "updated" | "skipped" }> {
  if (seed.pendingPdf) {
    warnings.push(`Facture ${seed.supplierReference} ignorée — PDF source absent (${seed.importKey}).`);
    return { id: "", action: "skipped" };
  }

  const supplierId = supplierIds.get(seed.supplierImportKey);
  if (!supplierId) {
    warnings.push(`Fournisseur manquant pour ${seed.importKey}`);
    return { id: "", action: "skipped" };
  }

  const invoiceNumber = supplierInvoiceNumberFromSeed(seed);
  const existing = await prisma.supplierInvoice.findFirst({
    where: {
      organizationId,
      OR: [
        { supplierInvoiceNumber: invoiceNumber },
        { supplierReference: seed.supplierReference, supplierId },
      ],
    },
    select: { id: true },
  });

  const lineInputs = seed.lines.map((line) => ({
    quantity: line.quantity,
    unitPriceExcludingTax: line.unitPriceExcludingTax,
    discountAmount: line.discountAmount ?? 0,
    vatRate: line.vatRate ?? seed.defaultVatRate ?? 20,
  }));

  const amountPaid = seed.amountPaid ?? 0;
  const totals = calculateSupplierInvoiceTotals(lineInputs, amountPaid);

  let paymentStatus: SupplierInvoicePaymentStatus = "UNPAID";
  if (amountPaid > 0 && amountPaid < totals.totalIncludingTax) {
    paymentStatus = "PARTIALLY_PAID";
  } else if (amountPaid >= totals.totalIncludingTax) {
    paymentStatus = "PAID";
  }

  const header = {
    supplierReference: seed.supplierReference,
    supplierId,
    status: "VALIDATED" as const,
    paymentStatus,
    type: "STANDARD" as const,
    issueDate: new Date(seed.issueDate),
    receivedDate: new Date(seed.receivedDate),
    dueDate: new Date(seed.dueDate),
    currency: seed.currency ?? "EUR",
    paymentTermsDays: 0,
    title: seed.title,
    description: seed.internalNotes,
    internalNotes: seed.internalNotes,
    defaultVatRate: seed.defaultVatRate ?? 20,
    subtotalExcludingTax: seed.subtotalExcludingTax ?? totals.subtotalExcludingTax,
    totalDiscountAmount: seed.totalDiscountAmount ?? totals.totalDiscountAmount,
    totalExcludingTax: seed.totalExcludingTax,
    totalVatAmount: seed.totalVatAmount,
    totalIncludingTax: seed.totalIncludingTax,
    amountPaid,
    amountDue: seed.amountDue ?? totals.amountDue,
  };

  const totalsDb = mapMoneyFieldsToDb(header, [...SUPPLIER_INVOICE_TOTAL_FIELDS]);

  let invoiceId: string;
  let action: "created" | "updated";

  if (existing) {
    await prisma.supplierInvoice.update({
      where: { id: existing.id },
      data: totalsDb,
    });
    invoiceId = existing.id;
    action = "updated";
    await prisma.supplierInvoiceLine.deleteMany({ where: { supplierInvoiceId: invoiceId } });
  } else {
    const created = await prisma.supplierInvoice.create({
      data: {
        organizationId,
        supplierInvoiceNumber: invoiceNumber,
        ...totalsDb,
      },
    });
    invoiceId = created.id;
    action = "created";
  }

  for (const [index, line] of seed.lines.entries()) {
    const calc = totals.lines[index];
    const lineData = mapMoneyFieldsToDb(
      {
        organizationId,
        supplierInvoiceId: invoiceId,
        position: index,
        reference: line.reference,
        name: line.name,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit ?? "pièce",
        unitPriceExcludingTax: line.unitPriceExcludingTax,
        discountAmount: line.discountAmount ?? 0,
        vatRate: line.vatRate ?? seed.defaultVatRate ?? 20,
        totalExcludingTax: calc?.totalExcludingTax ?? line.quantity * line.unitPriceExcludingTax,
        totalVatAmount: calc?.totalVatAmount ?? 0,
        totalIncludingTax: calc?.totalIncludingTax ?? 0,
      },
      [...SUPPLIER_INVOICE_LINE_MONEY_FIELDS],
    );
    await prisma.supplierInvoiceLine.create({ data: lineData });
  }

  return { id: invoiceId, action };
}

async function upsertDocument(
  prisma: PrismaClient,
  organizationId: string,
  dataDir: string,
  doc: (typeof ESTHER_REAL_DOCUMENTS)[number],
  entityIds: {
    customers: Map<string, string>;
    suppliers: Map<string, string>;
    supplierInvoices: Map<string, string>;
  },
  warnings: string[],
): Promise<{ id: string; action: "created" | "updated" | "skipped" }> {
  const absolutePath = path.join(dataDir, doc.relativePdfPath);
  try {
    await fs.access(absolutePath);
  } catch {
    warnings.push(`PDF introuvable: ${absolutePath} (${doc.importKey})`);
    return { id: "", action: "skipped" };
  }

  const buffer = await fs.readFile(absolutePath);
  const stored = await seedPutFile({
    organizationId,
    category: "esther-real",
    fileName: doc.fileName,
    body: buffer,
    mimeType: "application/pdf",
  });

  const entityId =
    doc.entityType === "Customer"
      ? entityIds.customers.get(doc.entityImportKey)
      : doc.entityType === "Supplier"
        ? entityIds.suppliers.get(doc.entityImportKey)
        : entityIds.supplierInvoices.get(doc.entityImportKey);

  if (!entityId) {
    warnings.push(`Entité introuvable pour document ${doc.importKey}`);
    return { id: "", action: "skipped" };
  }

  const existing = await prisma.document.findFirst({
    where: {
      organizationId,
      entityType: doc.entityType,
      entityId,
      title: doc.title,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.document.update({
      where: { id: existing.id },
      data: {
        title: doc.title,
        description: doc.description,
        entityType: doc.entityType,
        entityId,
        storageKey: stored.storageKey,
        mimeType: "application/pdf",
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
      },
    });
    return { id: existing.id, action: "updated" };
  }

  const created = await prisma.document.create({
    data: {
      organizationId,
      type: doc.type,
      status: "GENERATED",
      title: doc.title,
      description: doc.description,
      entityType: doc.entityType,
      entityId,
      fileName: doc.fileName,
      storageKey: stored.storageKey,
      mimeType: "application/pdf",
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      generatedAt: new Date(),
    },
  });

  if (doc.entityType === "SupplierInvoice") {
    const existingAttachment = await prisma.supplierInvoiceAttachment.findFirst({
      where: { organizationId, supplierInvoiceId: entityId, checksum: stored.checksum },
    });
    if (!existingAttachment) {
      await prisma.supplierInvoiceAttachment.create({
        data: {
          organizationId,
          supplierInvoiceId: entityId,
          fileName: doc.fileName,
          storageKey: stored.storageKey,
          mimeType: "application/pdf",
          sizeBytes: stored.sizeBytes,
          checksum: stored.checksum,
          type: "INVOICE_PDF",
        },
      });
    }
  }

  return { id: created.id, action: "created" };
}

export type ImportEstherRealDataOptions = {
  organizationId?: string;
  organizationSlug?: string;
  dataDir?: string;
  dryRun?: boolean;
};

export async function importEstherRealData(
  prisma: PrismaClient,
  options: ImportEstherRealDataOptions = {},
): Promise<EstherImportReport> {
  const dataDir = resolveEstherDataDir(options.dataDir);
  const org = await resolveOrganizationId(prisma, options);
  const report: EstherImportReport = {
    organizationId: org.id,
    organizationName: org.name,
    customers: [],
    suppliers: [],
    products: [],
    supplierInvoices: [],
    documents: [],
    warnings: [],
    skipped: [],
  };

  if (options.dryRun) {
    report.warnings.push("Mode dry-run — aucune écriture en base.");
    return report;
  }

  const category = await ensureTextileCategory(prisma, org.id);
  const unit = await ensurePieceUnit(prisma, org.id);

  const customerIds = new Map<string, string>();
  for (const seed of ESTHER_REAL_CUSTOMERS) {
    const result = await upsertCustomer(prisma, org.id, seed);
    customerIds.set(seed.importKey, result.id);
    report.customers.push({ importKey: seed.importKey, id: result.id, action: result.action });
  }

  const supplierIds = new Map<string, string>();
  for (const seed of ESTHER_REAL_SUPPLIERS) {
    const result = await upsertSupplier(prisma, org.id, seed);
    supplierIds.set(seed.importKey, result.id);
    report.suppliers.push({ importKey: seed.importKey, id: result.id, action: result.action });
  }

  for (const seed of ESTHER_REAL_PRODUCTS) {
    const result = await upsertProduct(prisma, org.id, seed, category.id, unit.id, supplierIds);
    report.products.push({ sku: seed.sku, id: result.id, action: result.action });
  }

  const supplierInvoiceIds = new Map<string, string>();
  for (const seed of ESTHER_REAL_SUPPLIER_INVOICES) {
    const result = await upsertSupplierInvoice(prisma, org.id, seed, supplierIds, report.warnings);
    if (result.action === "skipped") {
      report.skipped.push(seed.importKey);
    } else {
      supplierInvoiceIds.set(seed.importKey, result.id);
      report.supplierInvoices.push({
        importKey: seed.importKey,
        id: result.id,
        action: result.action,
      });
    }
  }

  for (const doc of ESTHER_REAL_DOCUMENTS) {
    const result = await upsertDocument(
      prisma,
      org.id,
      dataDir,
      doc,
      {
        customers: customerIds,
        suppliers: supplierIds,
        supplierInvoices: supplierInvoiceIds,
      },
      report.warnings,
    );
    if (result.action === "skipped") {
      report.skipped.push(doc.importKey);
    } else {
      report.documents.push({ importKey: doc.importKey, id: result.id, action: result.action });
    }
  }

  return report;
}

export function formatImportReport(report: EstherImportReport): string {
  const lines = [
    `Organisation: ${report.organizationName} (${report.organizationId})`,
    "",
    `Clients (${report.customers.length}):`,
    ...report.customers.map((c) => `  - ${c.importKey}: ${c.action} (${c.id})`),
    "",
    `Fournisseurs (${report.suppliers.length}):`,
    ...report.suppliers.map((s) => `  - ${s.importKey}: ${s.action} (${s.id})`),
    "",
    `Produits (${report.products.length}):`,
    ...report.products.map((p) => `  - ${p.sku}: ${p.action} (${p.id})`),
    "",
    `Factures fournisseur (${report.supplierInvoices.length}):`,
    ...report.supplierInvoices.map((i) => `  - ${i.importKey}: ${i.action} (${i.id})`),
    "",
    `Documents (${report.documents.length}):`,
    ...report.documents.map((d) => `  - ${d.importKey}: ${d.action} (${d.id})`),
  ];

  if (report.warnings.length) {
    lines.push("", "Avertissements:", ...report.warnings.map((w) => `  ⚠ ${w}`));
  }
  if (report.skipped.length) {
    lines.push("", "Ignorés:", ...report.skipped.map((s) => `  - ${s}`));
  }

  return lines.join("\n");
}
