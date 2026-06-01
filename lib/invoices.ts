import type { Prisma } from "@prisma/client";
import type { InvoiceFilterInput } from "@/lib/invoice-validators";
import { prisma } from "@/lib/prisma";

const defaultInclude = {
  customer: { select: { id: true, name: true, customerNumber: true, email: true } },
  customerContact: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  billingAddress: true,
  shippingAddress: true,
  quote: { select: { id: true, quoteNumber: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  lines: { orderBy: { position: "asc" as const }, include: { item: true } },
  activities: {
    orderBy: { createdAt: "desc" as const },
    include: { user: { select: { id: true, name: true } } },
  },
  creditNotes: {
    orderBy: { createdAt: "desc" as const },
    include: { lines: true },
  },
} satisfies Prisma.InvoiceInclude;

export function buildInvoiceWhere(
  organizationId: string,
  filters: Partial<InvoiceFilterInput>,
): Prisma.InvoiceWhereInput {
  const archivedFilter = filters.archived ?? "false";

  return {
    organizationId,
    ...(archivedFilter === "false" ? { isArchived: false } : {}),
    ...(archivedFilter === "only" ? { isArchived: true } : {}),
    ...(filters.status ? { status: filters.status as Prisma.EnumInvoiceStatusFilter["equals"] } : {}),
    ...(filters.paymentStatus
      ? { paymentStatus: filters.paymentStatus as Prisma.EnumInvoicePaymentStatusFilter["equals"] }
      : {}),
    ...(filters.type ? { type: filters.type as Prisma.EnumInvoiceTypeFilter["equals"] } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.overdue === "true"
      ? { OR: [{ status: "OVERDUE" }, { paymentStatus: "OVERDUE" }] }
      : {}),
    ...(filters.issueDateFrom || filters.issueDateTo
      ? {
          issueDate: {
            ...(filters.issueDateFrom ? { gte: new Date(filters.issueDateFrom) } : {}),
            ...(filters.issueDateTo ? { lte: new Date(filters.issueDateTo) } : {}),
          },
        }
      : {}),
    ...(filters.dueDateFrom || filters.dueDateTo
      ? {
          dueDate: {
            ...(filters.dueDateFrom ? { gte: new Date(filters.dueDateFrom) } : {}),
            ...(filters.dueDateTo ? { lte: new Date(filters.dueDateTo) } : {}),
          },
        }
      : {}),
    ...(filters.amountMin !== undefined || filters.amountMax !== undefined
      ? {
          totalIncludingTax: {
            ...(filters.amountMin !== undefined ? { gte: filters.amountMin } : {}),
            ...(filters.amountMax !== undefined ? { lte: filters.amountMax } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { invoiceNumber: { contains: filters.q } },
            { title: { contains: filters.q } },
            { subject: { contains: filters.q } },
            { internalNotes: { contains: filters.q } },
            { customerNotes: { contains: filters.q } },
            { customer: { name: { contains: filters.q } } },
          ],
        }
      : {}),
  };
}

function getOrderBy(
  sortBy: string,
  sortOrder: "asc" | "desc",
): Prisma.InvoiceOrderByWithRelationInput {
  if (sortBy === "customer") {
    return { customer: { name: sortOrder } };
  }
  return { [sortBy]: sortOrder };
}

export async function listInvoicesQuery(
  organizationId: string,
  filters: Partial<InvoiceFilterInput>,
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";

  const where = buildInvoiceWhere(organizationId, filters);
  const skip = (page - 1) * pageSize;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        quote: { select: { quoteNumber: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: getOrderBy(sortBy, sortOrder),
      skip,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { invoices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getInvoiceByIdQuery(organizationId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, organizationId },
    include: defaultInclude,
  });
}

export async function getInvoiceStatsQuery(organizationId: string) {
  return prisma.invoice.findMany({
    where: { organizationId },
    select: {
      status: true,
      paymentStatus: true,
      totalIncludingTax: true,
      amountPaid: true,
      amountDue: true,
      isArchived: true,
    },
  });
}

export async function getInvoicesForExportQuery(
  organizationId: string,
  filters: Partial<InvoiceFilterInput>,
) {
  const where = buildInvoiceWhere(organizationId, filters);
  return prisma.invoice.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      quote: { select: { quoteNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoiceFormDataQuery(organizationId: string) {
  const [customers, items, organization] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId, isArchived: false },
      include: {
        contacts: { orderBy: { isPrimary: "desc" } },
        addresses: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { organizationId, isArchived: false, status: "ACTIVE" },
      include: { unit: true, category: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        defaultCurrency: true,
        defaultLocale: true,
        defaultPaymentTermsDays: true,
        defaultInvoiceFooter: true,
        name: true,
        legalName: true,
        addressLine1: true,
        addressLine2: true,
        postalCode: true,
        city: true,
        country: true,
        phone: true,
        email: true,
        siret: true,
        vatNumber: true,
        logoUrl: true,
      },
    }),
  ]);

  return { customers, items, organization };
}

export async function getCustomersForInvoiceFilterQuery(organizationId: string) {
  return prisma.customer.findMany({
    where: { organizationId, isArchived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getCreditNoteByIdQuery(organizationId: string, id: string) {
  return prisma.creditNote.findFirst({
    where: { id, organizationId },
    include: {
      invoice: {
        select: { id: true, invoiceNumber: true, title: true },
      },
      customer: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      lines: { orderBy: { position: "asc" } },
    },
  });
}

export async function getInvoiceByQuoteIdQuery(organizationId: string, quoteId: string) {
  return prisma.invoice.findFirst({
    where: { organizationId, quoteId },
    select: { id: true, invoiceNumber: true },
  });
}
