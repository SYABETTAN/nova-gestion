import type { PrismaClient, SearchEntityType } from "@prisma/client";

const RECENT_QUERIES = [
  "atelier",
  "FAC-2026",
  "facture retard",
  "Horizon Conseil",
  "paiement virement",
  "fournisseur cloud",
  "TVA",
  "devis accepté",
  "écriture banque",
  "documents",
  "lumière",
  "REG-2026",
  "DEV-2026",
  "comptabilité",
  "export csv",
  "relance",
  "fournisseur",
  "article",
  "mapping",
  "sandbox",
];

export async function cleanupSearchModule(prisma: PrismaClient, organizationId: string) {
  await prisma.favoriteEntity.deleteMany({ where: { organizationId } });
  await prisma.searchHistory.deleteMany({ where: { organizationId } });
}

export async function seedSearch(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
) {
  await cleanupSearchModule(prisma, organizationId);

  const baseDate = new Date("2026-05-01");
  for (let i = 0; i < RECENT_QUERIES.length; i++) {
    await prisma.searchHistory.create({
      data: {
        organizationId,
        userId,
        query: RECENT_QUERIES[i],
        clicked: i % 3 === 0,
        createdAt: new Date(baseDate.getTime() + i * 3600000),
      },
    });
  }

  const [customers, invoices, quotes, payments, suppliers, supplierInvoices, entries, documents] =
    await Promise.all([
      prisma.customer.findMany({ where: { organizationId }, take: 2, orderBy: { name: "asc" } }),
      prisma.invoice.findMany({ where: { organizationId }, take: 2, orderBy: { createdAt: "desc" } }),
      prisma.quote.findMany({ where: { organizationId }, take: 1, orderBy: { createdAt: "desc" } }),
      prisma.payment.findMany({ where: { organizationId }, take: 1, orderBy: { createdAt: "desc" } }),
      prisma.supplier.findMany({ where: { organizationId }, take: 1, orderBy: { name: "asc" } }),
      prisma.supplierInvoice.findMany({
        where: { organizationId },
        take: 1,
        orderBy: { createdAt: "desc" },
      }),
      prisma.accountingEntry.findMany({
        where: { organizationId },
        take: 1,
        orderBy: { createdAt: "desc" },
      }),
      prisma.document.findMany({ where: { organizationId }, take: 1, orderBy: { createdAt: "desc" } }),
    ]);

  const favorites: {
    entityType: SearchEntityType;
    entityId: string;
    title: string;
    subtitle?: string;
    href: string;
  }[] = [];

  for (const c of customers) {
    favorites.push({
      entityType: "CUSTOMER",
      entityId: c.id,
      title: c.displayName ?? c.name,
      subtitle: c.customerNumber,
      href: `/customers/${c.id}`,
    });
  }
  for (const inv of invoices) {
    favorites.push({
      entityType: "INVOICE",
      entityId: inv.id,
      title: inv.invoiceNumber,
      subtitle: inv.title,
      href: `/invoices/${inv.id}`,
    });
  }
  if (quotes[0]) {
    favorites.push({
      entityType: "QUOTE",
      entityId: quotes[0].id,
      title: quotes[0].quoteNumber,
      subtitle: quotes[0].title,
      href: `/quotes/${quotes[0].id}`,
    });
  }
  if (payments[0]) {
    favorites.push({
      entityType: "PAYMENT",
      entityId: payments[0].id,
      title: payments[0].paymentNumber,
      href: `/payments/${payments[0].id}`,
    });
  }
  if (suppliers[0]) {
    favorites.push({
      entityType: "SUPPLIER",
      entityId: suppliers[0].id,
      title: suppliers[0].name,
      subtitle: suppliers[0].supplierNumber,
      href: `/suppliers/${suppliers[0].id}`,
    });
  }
  if (supplierInvoices[0]) {
    favorites.push({
      entityType: "SUPPLIER_INVOICE",
      entityId: supplierInvoices[0].id,
      title: supplierInvoices[0].supplierInvoiceNumber,
      href: `/supplier-invoices/${supplierInvoices[0].id}`,
    });
  }
  if (entries[0]) {
    favorites.push({
      entityType: "ACCOUNTING_ENTRY",
      entityId: entries[0].id,
      title: entries[0].entryNumber,
      subtitle: entries[0].label,
      href: `/accounting/entries/${entries[0].id}`,
    });
  }
  if (documents[0]) {
    favorites.push({
      entityType: "DOCUMENT",
      entityId: documents[0].id,
      title: documents[0].title,
      subtitle: documents[0].fileName,
      href: `/documents/${documents[0].id}`,
    });
  }

  for (const fav of favorites.slice(0, 10)) {
    await prisma.favoriteEntity.create({
      data: {
        organizationId,
        userId,
        ...fav,
      },
    });
  }
}
