import type { Prisma } from "@prisma/client";
import type { InvoiceFilterInput } from "@/lib/invoice-validators";
import { prisma } from "@/lib/prisma";
import { moneyToNumber } from "@/lib/money";

function safeDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

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
  const issueDateFrom = safeDate(filters.issueDateFrom);
  const issueDateTo = safeDate(filters.issueDateTo);
  const dueDateFrom = safeDate(filters.dueDateFrom);
  const dueDateTo = safeDate(filters.dueDateTo);

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
    ...(issueDateFrom || issueDateTo
      ? {
          issueDate: {
            ...(issueDateFrom ? { gte: issueDateFrom } : {}),
            ...(issueDateTo ? { lte: issueDateTo } : {}),
          },
        }
      : {}),
    ...(dueDateFrom || dueDateTo
      ? {
          dueDate: {
            ...(dueDateFrom ? { gte: dueDateFrom } : {}),
            ...(dueDateTo ? { lte: dueDateTo } : {}),
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
            { invoiceNumber: { contains: filters.q, mode: "insensitive" } },
            { title: { contains: filters.q, mode: "insensitive" } },
            { subject: { contains: filters.q, mode: "insensitive" } },
            { internalNotes: { contains: filters.q, mode: "insensitive" } },
            { customerNotes: { contains: filters.q, mode: "insensitive" } },
            { customer: { name: { contains: filters.q, mode: "insensitive" } } },
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
  const base = { organizationId, isArchived: false };

  const [
    total,
    drafts,
    validatedOrSent,
    paid,
    overdue,
    toCollectAgg,
    totalInvoicedAgg,
    totalPaidAgg,
    totalUnpaidAgg,
    validatedCount,
  ] = await Promise.all([
    prisma.invoice.count({ where: base }),
    prisma.invoice.count({ where: { ...base, status: "DRAFT" } }),
    prisma.invoice.count({ where: { ...base, status: { in: ["VALIDATED", "SENT"] } } }),
    prisma.invoice.count({ where: { ...base, status: "PAID" } }),
    prisma.invoice.count({
      where: { ...base, OR: [{ status: "OVERDUE" }, { paymentStatus: "OVERDUE" }] },
    }),
    prisma.invoice.aggregate({
      where: { ...base, status: { notIn: ["PAID", "CANCELLED", "CREDITED", "DRAFT"] } },
      _sum: { amountDue: true },
    }),
    prisma.invoice.aggregate({
      where: { ...base, status: { notIn: ["DRAFT", "CANCELLED"] } },
      _sum: { totalIncludingTax: true },
    }),
    prisma.invoice.aggregate({ where: base, _sum: { amountPaid: true } }),
    prisma.invoice.aggregate({
      where: { ...base, status: { notIn: ["PAID", "CANCELLED", "CREDITED"] } },
      _sum: { amountDue: true },
    }),
    prisma.invoice.count({ where: { ...base, status: { not: "DRAFT" } } }),
  ]);

  const { moneyToNumber } = await import("@/lib/money");
  const totalInvoiced = moneyToNumber(totalInvoicedAgg._sum.totalIncludingTax ?? 0);

  return {
    total,
    drafts,
    validatedOrSent,
    paid,
    overdue,
    toCollect: moneyToNumber(toCollectAgg._sum.amountDue ?? 0),
    totalInvoiced,
    totalPaid: moneyToNumber(totalPaidAgg._sum.amountPaid ?? 0),
    totalUnpaid: moneyToNumber(totalUnpaidAgg._sum.amountDue ?? 0),
    averageBasket: validatedCount > 0 ? totalInvoiced / validatedCount : 0,
  };
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

// ---------------------------------------------------------------------------
// Grille Factures « façon Sage »
// ---------------------------------------------------------------------------

export type InvoiceGridCriteria =
  | "ALL"
  | "PROVISIONAL"
  | "SETTLED"
  | "TO_REMIND"
  | "UNPAID"
  | "VALIDATED_UNPAID"
  | "ACCOUNTED"
  | "NOT_ACCOUNTED";

const INVOICE_GRID_CRITERIA: InvoiceGridCriteria[] = [
  "ALL",
  "PROVISIONAL",
  "SETTLED",
  "TO_REMIND",
  "UNPAID",
  "VALIDATED_UNPAID",
  "ACCOUNTED",
  "NOT_ACCOUNTED",
];

export function parseInvoiceGridCriteria(value?: string | null): InvoiceGridCriteria {
  return value && (INVOICE_GRID_CRITERIA as string[]).includes(value)
    ? (value as InvoiceGridCriteria)
    : "ALL";
}

/** Identifiants des factures déjà comptabilisées (écriture issue d'une facture client). */
export async function getAccountedInvoiceIdSet(organizationId: string): Promise<Set<string>> {
  const entries = await prisma.accountingEntry.findMany({
    where: { organizationId, sourceType: "CUSTOMER_INVOICE", sourceId: { not: null } },
    select: { sourceId: true },
  });
  return new Set(
    entries.map((e) => e.sourceId).filter((id): id is string => Boolean(id)),
  );
}

function buildCriteriaWhere(
  criteria: InvoiceGridCriteria,
  accountedIds: Set<string>,
): Prisma.InvoiceWhereInput | null {
  switch (criteria) {
    case "PROVISIONAL":
      return { status: "DRAFT" };
    case "SETTLED":
      return { OR: [{ paymentStatus: "PAID" }, { status: "PAID" }] };
    case "TO_REMIND":
      return { OR: [{ status: "OVERDUE" }, { paymentStatus: "OVERDUE" }] };
    case "UNPAID":
      return {
        status: { notIn: ["DRAFT", "CANCELLED", "CREDITED", "PAID"] },
        amountDue: { gt: 0 },
      };
    case "VALIDATED_UNPAID":
      return {
        status: { in: ["VALIDATED", "SENT", "OVERDUE", "PARTIALLY_PAID"] },
        amountDue: { gt: 0 },
      };
    case "ACCOUNTED":
      return { id: { in: [...accountedIds] } };
    case "NOT_ACCOUNTED":
      return { id: { notIn: [...accountedIds] } };
    case "ALL":
    default:
      return null;
  }
}

export type InvoiceGridRow = {
  id: string;
  invoiceNumber: string;
  type: string;
  status: import("@prisma/client").InvoiceStatus;
  paymentStatus: import("@prisma/client").InvoicePaymentStatus;
  issueDate: Date;
  dueDate: Date;
  paymentTermsDays: number;
  customerId: string;
  customerName: string;
  companyName: string;
  customerNumber: string;
  country: string;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  isAccounted: boolean;
};

export type InvoiceGridResult = {
  invoices: InvoiceGridRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totals: {
    totalExcludingTax: number;
    totalVatAmount: number;
    totalIncludingTax: number;
    amountDue: number;
  };
  exercise: { from: Date | null; to: Date | null };
};

export async function listInvoicesForSageGridQuery(
  organizationId: string,
  filters: Partial<InvoiceFilterInput> & { criteria?: string },
): Promise<InvoiceGridResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const criteria = parseInvoiceGridCriteria(filters.criteria);

  // Toujours nécessaire : sert à la fois au filtre « comptabilisée » et à la colonne.
  const accountedIds = await getAccountedInvoiceIdSet(organizationId);

  const base = buildInvoiceWhere(organizationId, filters);
  const criteriaWhere = buildCriteriaWhere(criteria, accountedIds);
  const where: Prisma.InvoiceWhereInput = criteriaWhere
    ? { AND: [base, criteriaWhere] }
    : base;

  const skip = (page - 1) * pageSize;

  const [rows, total, agg] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, legalName: true, customerNumber: true } },
        billingAddress: { select: { country: true } },
      },
      orderBy: { issueDate: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where,
      _sum: {
        totalExcludingTax: true,
        totalVatAmount: true,
        totalIncludingTax: true,
        amountDue: true,
      },
      _min: { issueDate: true },
      _max: { issueDate: true },
    }),
  ]);

  const invoices: InvoiceGridRow[] = rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    type: r.type,
    status: r.status,
    paymentStatus: r.paymentStatus,
    issueDate: r.issueDate,
    dueDate: r.dueDate,
    paymentTermsDays: r.paymentTermsDays,
    customerId: r.customerId,
    customerName: r.customer.name,
    companyName: r.customer.legalName ?? r.customer.name,
    customerNumber: r.customer.customerNumber,
    country: r.billingAddress?.country ?? "",
    totalExcludingTax: moneyToNumber(r.totalExcludingTax),
    totalVatAmount: moneyToNumber(r.totalVatAmount),
    totalIncludingTax: moneyToNumber(r.totalIncludingTax),
    amountPaid: moneyToNumber(r.amountPaid),
    amountDue: moneyToNumber(r.amountDue),
    currency: r.currency,
    isAccounted: accountedIds.has(r.id),
  }));

  return {
    invoices,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    totals: {
      totalExcludingTax: moneyToNumber(agg._sum.totalExcludingTax ?? 0),
      totalVatAmount: moneyToNumber(agg._sum.totalVatAmount ?? 0),
      totalIncludingTax: moneyToNumber(agg._sum.totalIncludingTax ?? 0),
      amountDue: moneyToNumber(agg._sum.amountDue ?? 0),
    },
    exercise: { from: agg._min.issueDate ?? null, to: agg._max.issueDate ?? null },
  };
}
