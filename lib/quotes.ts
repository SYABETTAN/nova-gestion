import type { Prisma } from "@prisma/client";
import type { QuoteFilterInput } from "@/lib/quote-validators";
import { prisma } from "@/lib/prisma";

const defaultInclude = {
  customer: { select: { id: true, name: true, customerNumber: true, email: true } },
  customerContact: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  billingAddress: true,
  shippingAddress: true,
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  lines: { orderBy: { position: "asc" as const }, include: { item: true } },
  activities: {
    orderBy: { createdAt: "desc" as const },
    include: { user: { select: { id: true, name: true } } },
  },
} satisfies Prisma.QuoteInclude;

export function buildQuoteWhere(
  organizationId: string,
  filters: Partial<QuoteFilterInput>,
): Prisma.QuoteWhereInput {
  const archivedFilter = filters.archived ?? "false";

  return {
    organizationId,
    ...(archivedFilter === "false" ? { isArchived: false } : {}),
    ...(archivedFilter === "only" ? { isArchived: true } : {}),
    ...(filters.status ? { status: filters.status as Prisma.EnumQuoteStatusFilter["equals"] } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.issueDateFrom || filters.issueDateTo
      ? {
          issueDate: {
            ...(filters.issueDateFrom ? { gte: new Date(filters.issueDateFrom) } : {}),
            ...(filters.issueDateTo ? { lte: new Date(filters.issueDateTo) } : {}),
          },
        }
      : {}),
    ...(filters.validUntilFrom || filters.validUntilTo
      ? {
          validUntil: {
            ...(filters.validUntilFrom ? { gte: new Date(filters.validUntilFrom) } : {}),
            ...(filters.validUntilTo ? { lte: new Date(filters.validUntilTo) } : {}),
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
            { quoteNumber: { contains: filters.q } },
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
): Prisma.QuoteOrderByWithRelationInput {
  if (sortBy === "customer") {
    return { customer: { name: sortOrder } };
  }
  return { [sortBy]: sortOrder };
}

export async function listQuotesQuery(
  organizationId: string,
  filters: Partial<QuoteFilterInput>,
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";

  const where = buildQuoteWhere(organizationId, filters);
  const skip = (page - 1) * pageSize;

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: getOrderBy(sortBy, sortOrder),
      skip,
      take: pageSize,
    }),
    prisma.quote.count({ where }),
  ]);

  return {
    quotes,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getQuoteByIdQuery(organizationId: string, id: string) {
  return prisma.quote.findFirst({
    where: { id, organizationId },
    include: defaultInclude,
  });
}

export async function getQuoteStatsQuery(organizationId: string) {
  const base = { organizationId, isArchived: false };
  const { moneyToNumber } = await import("@/lib/money");

  const [
    total,
    drafts,
    sent,
    accepted,
    expired,
    acceptedAmountAgg,
    pendingAmountAgg,
    sentCount,
    decidedCount,
  ] = await Promise.all([
    prisma.quote.count({ where: base }),
    prisma.quote.count({ where: { ...base, status: "DRAFT" } }),
    prisma.quote.count({ where: { ...base, status: { in: ["SENT", "VIEWED"] } } }),
    prisma.quote.count({ where: { ...base, status: "ACCEPTED" } }),
    prisma.quote.count({ where: { ...base, status: "EXPIRED" } }),
    prisma.quote.aggregate({
      where: { ...base, status: { in: ["ACCEPTED", "CONVERTED"] } },
      _sum: { totalIncludingTax: true },
    }),
    prisma.quote.aggregate({
      where: { ...base, status: { in: ["SENT", "VIEWED"] } },
      _sum: { totalIncludingTax: true },
    }),
    prisma.quote.count({ where: { ...base, status: { in: ["SENT", "VIEWED"] } } }),
    prisma.quote.count({
      where: { ...base, status: { in: ["ACCEPTED", "REFUSED", "EXPIRED", "CONVERTED"] } },
    }),
  ]);

  const acceptedAmount = moneyToNumber(acceptedAmountAgg._sum.totalIncludingTax ?? 0);
  const pendingAmount = moneyToNumber(pendingAmountAgg._sum.totalIncludingTax ?? 0);

  return {
    total,
    drafts,
    sent,
    accepted,
    expired,
    acceptedAmount,
    pendingAmount,
    acceptanceRate: decidedCount > 0 ? Math.round((accepted / decidedCount) * 100) : 0,
    averageBasket: accepted > 0 ? acceptedAmount / accepted : 0,
    sentCount,
  };
}

export async function getQuotesForExportQuery(
  organizationId: string,
  filters: Partial<QuoteFilterInput>,
) {
  const where = buildQuoteWhere(organizationId, filters);
  return prisma.quote.findMany({
    where,
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuoteFormDataQuery(organizationId: string) {
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
        defaultQuoteFooter: true,
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

export async function getCustomersForFilterQuery(organizationId: string) {
  return prisma.customer.findMany({
    where: { organizationId, isArchived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
