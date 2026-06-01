import {
  PrismaClient,
  SupplierInvoiceActivityType,
  SupplierInvoicePaymentStatus,
  SupplierInvoiceStatus,
  SupplierInvoiceType,
} from "@prisma/client";
import { calculateSupplierInvoiceTotals } from "../lib/supplier-invoice-calculations";
import { toDbDecimal } from "../lib/money";
import {
  mapMoneyFieldsToDb,
  SUPPLIER_INVOICE_LINE_MONEY_FIELDS,
  SUPPLIER_INVOICE_TOTAL_FIELDS,
} from "../lib/money-db";
import { SEED_PLACEHOLDER_PDF, seedPutFile } from "../lib/seed/storage-seed";

const EXPENSE_CATEGORIES = [
  { name: "Logiciels", color: "#7c3aed", defaultVatRate: 20, accountingAccountPlaceholder: "606300", sortOrder: 1 },
  { name: "Sous-traitance", color: "#2563eb", defaultVatRate: 20, accountingAccountPlaceholder: "611000", sortOrder: 2 },
  { name: "Fournitures", color: "#059669", defaultVatRate: 20, accountingAccountPlaceholder: "606400", sortOrder: 3 },
  { name: "Télécommunications", color: "#0891b2", defaultVatRate: 20, accountingAccountPlaceholder: "626000", sortOrder: 4 },
  { name: "Transport", color: "#d97706", defaultVatRate: 20, accountingAccountPlaceholder: "624000", sortOrder: 5 },
  { name: "Marketing", color: "#db2777", defaultVatRate: 20, accountingAccountPlaceholder: "623000", sortOrder: 6 },
  { name: "Conseil", color: "#9333ea", defaultVatRate: 20, accountingAccountPlaceholder: "622600", sortOrder: 7 },
  { name: "Maintenance", color: "#ca8a04", defaultVatRate: 20, accountingAccountPlaceholder: "615000", sortOrder: 8 },
  { name: "Frais bancaires", color: "#64748b", defaultVatRate: 0, accountingAccountPlaceholder: "627000", sortOrder: 9 },
  { name: "Services généraux", color: "#475569", defaultVatRate: 20, accountingAccountPlaceholder: "606100", sortOrder: 10 },
];

const TITLES = [
  "Abonnement logiciel mensuel",
  "Prestation de conseil",
  "Fournitures de bureau",
  "Maintenance informatique",
  "Frais de télécommunication",
  "Transport et livraison",
  "Campagne marketing",
  "Services de nettoyage",
  "Hébergement cloud",
  "Assistance technique",
  "Sous-traitance développement",
  "Achat matériel informatique",
  "Frais bancaires",
  "Traduction documents",
  "Formation externe",
];

const STATUS_DIST: SupplierInvoiceStatus[] = [
  ...Array(8).fill("DRAFT"),
  ...Array(30).fill("VALIDATED"),
  ...Array(7).fill("CANCELLED"),
] as SupplierInvoiceStatus[];

const PAYMENT_DIST: SupplierInvoicePaymentStatus[] = [
  ...Array(22).fill("UNPAID"),
  ...Array(9).fill("PARTIALLY_PAID"),
  ...Array(14).fill("PAID"),
  ...Array(5).fill("OVERDUE"),
] as SupplierInvoicePaymentStatus[];

const TYPE_DIST: SupplierInvoiceType[] = [
  ...Array(42).fill("STANDARD"),
  ...Array(4).fill("CREDIT_NOTE"),
  ...Array(2).fill("DEPOSIT"),
  ...Array(2).fill("OTHER"),
] as SupplierInvoiceType[];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export async function seedSupplierInvoices(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
) {
  console.log("  Seeding supplier invoices...");

  await prisma.supplierInvoiceActivity.deleteMany({ where: { organizationId } });
  await prisma.supplierInvoiceAttachment.deleteMany({ where: { organizationId } });
  await prisma.supplierInvoiceLine.deleteMany({ where: { organizationId } });
  await prisma.supplierInvoice.deleteMany({ where: { organizationId } });
  await prisma.expenseCategory.deleteMany({ where: { organizationId } });

  const categories = [];
  for (const c of EXPENSE_CATEGORIES) {
    categories.push(await prisma.expenseCategory.create({ data: { organizationId, ...c } }));
  }

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId, isArchived: false },
    orderBy: { name: "asc" },
  });
  if (suppliers.length === 0) {
    console.warn("  ⚠ Skipping supplier invoices seed");
    return;
  }

  let lineCount = 0;
  let attachmentCount = 0;
  let activityCount = 0;

  for (let i = 0; i < 50; i++) {
    const supplier = suppliers[i % suppliers.length];
    const status = STATUS_DIST[i];
    const paymentStatus = status === "CANCELLED" ? "UNPAID" : PAYMENT_DIST[i];
    const type = TYPE_DIST[i];
    const category = categories[i % categories.length];
    const issueDate = daysAgo(90 - i * 2);
    const receivedDate = addDays(issueDate, 1);
    const dueDate = addDays(issueDate, supplier.defaultPaymentTermsDays);
    const isArchived = i >= 45;

    const lineInputs = [];
    const numLines = 1 + (i % 5);
    for (let l = 0; l < numLines; l++) {
      const qty = 1 + (l % 3);
      const unitPrice = 150 + i * 25 + l * 40;
      const discount = l === 1 ? 20 : 0;
      lineInputs.push({
        quantity: qty,
        unitPriceExcludingTax: unitPrice,
        discountAmount: discount,
        vatRate: category.defaultVatRate,
      });
    }

    const totals = calculateSupplierInvoiceTotals(lineInputs, 0);
    let amountPaid = 0;
    let amountDue = totals.totalIncludingTax;
    let paidAt: Date | null = null;

    if (status === "VALIDATED" && paymentStatus === "PAID") {
      amountPaid = totals.totalIncludingTax;
      amountDue = 0;
      paidAt = addDays(dueDate, -2);
    } else if (status === "VALIDATED" && paymentStatus === "PARTIALLY_PAID") {
      amountPaid = Math.round(totals.totalIncludingTax * 0.4 * 100) / 100;
      amountDue = Math.round((totals.totalIncludingTax - amountPaid) * 100) / 100;
    }

    const invoiceNumber = `ACH-2026-${String(i + 1).padStart(4, "0")}`;
    const title = TITLES[i % TITLES.length];

    const invoiceTotals = mapMoneyFieldsToDb(
      {
        subtotalExcludingTax: totals.subtotalExcludingTax,
        totalDiscountAmount: totals.totalDiscountAmount,
        totalExcludingTax: totals.totalExcludingTax,
        totalVatAmount: totals.totalVatAmount,
        totalIncludingTax: totals.totalIncludingTax,
        amountPaid,
        amountDue,
      },
      [...SUPPLIER_INVOICE_TOTAL_FIELDS],
    );

    const invoice = await prisma.supplierInvoice.create({
      data: {
        organizationId,
        supplierInvoiceNumber: invoiceNumber,
        supplierReference: `FOUR-REF-${String(1000 + i)}`,
        supplierId: supplier.id,
        status,
        paymentStatus: status === "VALIDATED" ? paymentStatus : "UNPAID",
        type,
        issueDate,
        receivedDate,
        dueDate,
        validatedAt: status === "VALIDATED" || status === "CANCELLED" ? addDays(issueDate, 2) : null,
        cancelledAt: status === "CANCELLED" ? addDays(issueDate, 10) : null,
        paidAt,
        currency: "EUR",
        paymentTermsDays: supplier.defaultPaymentTermsDays,
        title,
        description: `${title}`,
        internalNotes: i % 4 === 0 ? "Note interne facture fournisseur fictive" : null,
        ...invoiceTotals,
        defaultVatRate: toDbDecimal(category.defaultVatRate),
        expenseCategoryId: category.id,
        createdById: userId,
        isArchived,
        archivedAt: isArchived ? daysAgo(5) : null,
      },
    });

    for (let l = 0; l < numLines; l++) {
      const line = totals.lines[l];
      await prisma.supplierInvoiceLine.create({
        data: mapMoneyFieldsToDb(
          {
            organizationId,
            supplierInvoiceId: invoice.id,
            expenseCategoryId: category.id,
            position: l,
            reference: `LIG-${l + 1}`,
            name: `${title} — ligne ${l + 1}`,
            quantity: line.quantity,
            unit: l === 0 ? "mois" : "unité",
            unitPriceExcludingTax: line.unitPriceExcludingTax,
            discountAmount: line.discountAmount,
            vatRate: line.vatRate,
            totalExcludingTax: line.totalExcludingTax,
            totalVatAmount: line.totalVatAmount,
            totalIncludingTax: line.totalIncludingTax,
          },
          [...SUPPLIER_INVOICE_LINE_MONEY_FIELDS],
        ),
      });
      lineCount++;
    }

    if (i % 2 === 0) {
      const stored = await seedPutFile({
        organizationId,
        category: "seed-supplier-invoices",
        fileName: `facture-${invoiceNumber}.pdf`,
        body: SEED_PLACEHOLDER_PDF,
        mimeType: "application/pdf",
      });
      await prisma.supplierInvoiceAttachment.create({
        data: {
          organizationId,
          supplierInvoiceId: invoice.id,
          fileName: `facture-${invoiceNumber}.pdf`,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
          mimeType: "application/pdf",
          sizeBytes: stored.sizeBytes,
          type: "INVOICE_PDF",
          uploadedById: userId,
        },
      });
      attachmentCount++;
    }
    if (i % 3 === 0) {
      const stored = await seedPutFile({
        organizationId,
        category: "seed-supplier-invoices",
        fileName: `justificatif-${invoiceNumber}.pdf`,
        body: SEED_PLACEHOLDER_PDF,
        mimeType: "application/pdf",
      });
      await prisma.supplierInvoiceAttachment.create({
        data: {
          organizationId,
          supplierInvoiceId: invoice.id,
          fileName: `justificatif-${invoiceNumber}.pdf`,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
          mimeType: "application/pdf",
          sizeBytes: stored.sizeBytes,
          type: "RECEIPT",
          uploadedById: userId,
        },
      });
      attachmentCount++;
    }

    const activities: { type: SupplierInvoiceActivityType; title: string; description?: string }[] = [
      { type: "CREATED", title: "Facture fournisseur créée" },
    ];
    if (status === "VALIDATED") activities.push({ type: "VALIDATED", title: "Facture validée" });
    if (paymentStatus === "PAID" && status === "VALIDATED") {
      activities.push({ type: "MARKED_PAID_PLACEHOLDER", title: "Facture marquée payée en" });
    }
    if (paymentStatus === "PARTIALLY_PAID" && status === "VALIDATED") {
      activities.push({ type: "PARTIAL_PAYMENT_PLACEHOLDER", title: "Paiement partiel simulé" });
    }
    if (paymentStatus === "OVERDUE" && status === "VALIDATED") {
      activities.push({ type: "MARKED_OVERDUE", title: "Facture en retard" });
    }
    if (status === "CANCELLED") {
      activities.push({ type: "CANCELLED", title: "Facture annulée", description: "Annulation" });
    }
    if (i % 5 === 0) activities.push({ type: "ATTACHMENT_ADDED", title: "Pièce jointe fictive ajoutée" });
    if (i % 7 === 0) activities.push({ type: "NOTE", title: "Note interne ajoutée" });

    for (const act of activities) {
      await prisma.supplierInvoiceActivity.create({
        data: {
          organizationId,
          supplierInvoiceId: invoice.id,
          userId,
          type: act.type,
          title: act.title,
          description: act.description ?? null,
        },
      });
      activityCount++;
    }
  }

  while (activityCount < 120) {
    const inv = await prisma.supplierInvoice.findFirst({
      where: { organizationId },
      skip: activityCount % 50,
    });
    if (!inv) break;
    await prisma.supplierInvoiceActivity.create({
      data: {
        organizationId,
        supplierInvoiceId: inv.id,
        userId,
        type: "UPDATED",
        title: "Mise à jour",
      },
    });
    activityCount++;
  }

  console.log(
    `  ✓ ${categories.length} expense categories, 50 supplier invoices, ${lineCount} lines, ${attachmentCount} attachments, ${activityCount} activities`,
  );
}
