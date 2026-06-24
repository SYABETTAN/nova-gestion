import type { Prisma } from "@prisma/client";
import { hasFilterValue } from "@/lib/filter-params";
import type { CustomerFilterInput } from "@/lib/customer-validators";
import { prisma } from "@/lib/prisma";
import { moneyToNumber } from "@/lib/money";

export type CustomerListInclude = {
  tagAssignments: { include: { tag: true } };
  addresses: { where?: { isDefault?: boolean }; take?: number };
};

const defaultInclude = {
  tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
  addresses: { where: { isDefault: true }, take: 1, select: { city: true } },
} satisfies Prisma.CustomerInclude;

export function buildCustomerWhere(
  organizationId: string,
  filters: Partial<CustomerFilterInput>,
): Prisma.CustomerWhereInput {
  const archivedFilter = filters.archived ?? "false";

  const where: Prisma.CustomerWhereInput = {
    organizationId,
    ...(archivedFilter === "false" && filters.status !== "ARCHIVED"
      ? { isArchived: false }
      : {}),
    ...(archivedFilter === "only" ? { isArchived: true } : {}),
    ...(hasFilterValue(filters.status) && filters.status !== "ARCHIVED"
      ? { status: filters.status as Prisma.EnumCustomerStatusFilter["equals"] }
      : {}),
    ...(filters.status === "ARCHIVED" ? { status: "ARCHIVED", isArchived: true } : {}),
    ...(hasFilterValue(filters.type)
      ? { type: filters.type as Prisma.EnumCustomerTypeFilter["equals"] }
      : {}),
    ...(hasFilterValue(filters.city)
      ? {
          addresses: {
            some: { city: { contains: filters.city, mode: "insensitive" } },
          },
        }
      : {}),
    ...(hasFilterValue(filters.tagId)
      ? {
          tagAssignments: {
            some: { tagId: filters.tagId },
          },
        }
      : {}),
    ...(hasFilterValue(filters.q)
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { displayName: { contains: filters.q, mode: "insensitive" } },
            { customerNumber: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
            { phone: { contains: filters.q, mode: "insensitive" } },
            { siret: { contains: filters.q, mode: "insensitive" } },
            { vatNumber: { contains: filters.q, mode: "insensitive" } },
            { legalName: { contains: filters.q, mode: "insensitive" } },
            {
              contacts: {
                some: {
                  OR: [
                    { firstName: { contains: filters.q, mode: "insensitive" } },
                    { lastName: { contains: filters.q, mode: "insensitive" } },
                    { email: { contains: filters.q, mode: "insensitive" } },
                    { phone: { contains: filters.q, mode: "insensitive" } },
                    { mobile: { contains: filters.q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  return where;
}

export function buildCustomerOrderBy(
  sortBy: CustomerFilterInput["sortBy"] = "createdAt",
  sortOrder: CustomerFilterInput["sortOrder"] = "desc",
): Prisma.CustomerOrderByWithRelationInput {
  return { [sortBy]: sortOrder };
}

export async function listCustomersQuery(
  organizationId: string,
  filters: Partial<CustomerFilterInput>,
) {
  const parsed = {
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 20,
    sortBy: filters.sortBy ?? "createdAt",
    sortOrder: filters.sortOrder ?? "desc",
  };

  const where = buildCustomerWhere(organizationId, filters);
  const skip = (parsed.page - 1) * parsed.pageSize;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: defaultInclude,
      orderBy: buildCustomerOrderBy(parsed.sortBy, parsed.sortOrder),
      skip,
      take: parsed.pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.ceil(total / parsed.pageSize),
  };
}

export async function getCustomerByIdQuery(organizationId: string, id: string) {
  return prisma.customer.findFirst({
    where: { id, organizationId },
    include: {
      contacts: { orderBy: [{ isArchived: "asc" }, { isPrimary: "desc" }, { lastName: "asc" }] },
      addresses: { orderBy: [{ isDefault: "desc" }, { type: "asc" }] },
      customerNotes: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      tagAssignments: { include: { tag: true } },
      activities: { orderBy: { activityDate: "desc" } },
    },
  });
}

export async function searchCustomersForSelectQuery(
  organizationId: string,
  query: string,
  limit = 20,
) {
  const q = query.trim();
  if (!q) {
    return prisma.customer.findMany({
      where: { organizationId, isArchived: false },
      select: {
        id: true,
        name: true,
        displayName: true,
        customerNumber: true,
        email: true,
        phone: true,
        siret: true,
      },
      orderBy: { name: "asc" },
      take: limit,
    });
  }

  return prisma.customer.findMany({
    where: {
      organizationId,
      isArchived: false,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { legalName: { contains: q, mode: "insensitive" } },
        { customerNumber: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { siret: { contains: q, mode: "insensitive" } },
        { vatNumber: { contains: q, mode: "insensitive" } },
        {
          contacts: {
            some: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      customerNumber: true,
      email: true,
      phone: true,
      siret: true,
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export async function getCustomerOptionByIdQuery(organizationId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: {
      id: true,
      name: true,
      displayName: true,
      customerNumber: true,
      email: true,
      phone: true,
      siret: true,
      isArchived: true,
    },
  });
}

export async function getCustomerStatsQuery(organizationId: string) {
  const baseWhere = { organizationId, isArchived: false };
  const [total, prospects, active, outstanding] = await Promise.all([
    prisma.customer.count({ where: baseWhere }),
    prisma.customer.count({ where: { ...baseWhere, status: "PROSPECT" } }),
    prisma.customer.count({ where: { ...baseWhere, status: "ACTIVE" } }),
    prisma.customer.aggregate({ where: baseWhere, _sum: { outstandingAmount: true } }),
  ]);

  return {
    total,
    prospects,
    active,
    totalOutstanding: outstanding._sum.outstandingAmount ?? 0,
  };
}

export type CustomerGridRow = {
  id: string;
  customerNumber: string;
  type: string;
  status: string;
  name: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  city: string;
  country: string;
  siret: string | null;
  vatNumber: string | null;
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number;
  lastInvoiceDate: string | null;
  overdueCount: number;
  currency: string;
};

const NON_DRAFT_INVOICE: Prisma.InvoiceWhereInput["status"] = {
  notIn: ["DRAFT", "CANCELLED"],
};

export async function listCustomersForGridQuery(
  organizationId: string,
  filters: Partial<CustomerFilterInput> & {
    country?: string;
    balance?: string; // "due" | "overdue"
  },
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));

  const base = buildCustomerWhere(organizationId, filters);
  const and: Prisma.CustomerWhereInput[] = [base];
  if (hasFilterValue(filters.country)) {
    and.push({ addresses: { some: { country: { contains: filters.country, mode: "insensitive" } } } });
  }
  if (filters.balance === "due") {
    and.push({ invoices: { some: { amountDue: { gt: 0 }, status: NON_DRAFT_INVOICE } } });
  }
  if (filters.balance === "overdue") {
    and.push({
      invoices: {
        some: {
          amountDue: { gt: 0 },
          dueDate: { lt: new Date() },
          status: { notIn: ["DRAFT", "CANCELLED", "PAID"] },
        },
      },
    });
  }
  const where: Prisma.CustomerWhereInput = { AND: and };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        customerNumber: true,
        type: true,
        status: true,
        name: true,
        legalName: true,
        displayName: true,
        email: true,
        phone: true,
        siret: true,
        vatNumber: true,
        currency: true,
        addresses: {
          where: { isDefault: true },
          take: 1,
          select: { city: true, country: true },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const ids = customers.map((c) => c.id);
  const [sums, overdue] = await Promise.all([
    ids.length
      ? prisma.invoice.groupBy({
          by: ["customerId"],
          where: { organizationId, customerId: { in: ids }, status: NON_DRAFT_INVOICE, isArchived: false },
          _sum: { totalIncludingTax: true, amountPaid: true, amountDue: true },
          _max: { issueDate: true },
        })
      : Promise.resolve([] as Array<{ customerId: string; _sum: { totalIncludingTax: Prisma.Decimal | null; amountPaid: Prisma.Decimal | null; amountDue: Prisma.Decimal | null }; _max: { issueDate: Date | null } }>),
    ids.length
      ? prisma.invoice.groupBy({
          by: ["customerId"],
          where: {
            organizationId,
            customerId: { in: ids },
            amountDue: { gt: 0 },
            dueDate: { lt: new Date() },
            status: { notIn: ["DRAFT", "CANCELLED", "PAID"] },
          },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ customerId: string; _count: { _all: number } }>),
  ]);

  const sumByCustomer = new Map(sums.map((s) => [s.customerId, s]));
  const overdueByCustomer = new Map(overdue.map((o) => [o.customerId, o._count._all]));

  const rows: CustomerGridRow[] = customers.map((c) => {
    const s = sumByCustomer.get(c.id);
    return {
      id: c.id,
      customerNumber: c.customerNumber,
      type: c.type,
      status: c.status,
      name: c.name,
      companyName: c.legalName ?? c.displayName ?? "",
      email: c.email,
      phone: c.phone,
      city: c.addresses[0]?.city ?? "",
      country: c.addresses[0]?.country ?? "",
      siret: c.siret,
      vatNumber: c.vatNumber,
      totalInvoiced: moneyToNumber(s?._sum.totalIncludingTax ?? 0),
      totalPaid: moneyToNumber(s?._sum.amountPaid ?? 0),
      balanceDue: moneyToNumber(s?._sum.amountDue ?? 0),
      lastInvoiceDate: s?._max.issueDate ? s._max.issueDate.toISOString() : null,
      overdueCount: overdueByCustomer.get(c.id) ?? 0,
      currency: c.currency,
    };
  });

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function buildCustomersGridCsv(rows: CustomerGridRow[]): string {
  const header = [
    "Code client",
    "Société",
    "Nom",
    "Téléphone",
    "Email",
    "Ville",
    "Pays",
    "SIRET",
    "TVA intracom.",
    "Total facturé",
    "Total payé",
    "Solde dû",
    "Dernière facture",
    "Statut",
  ].join(";");
  const lines = rows.map((r) =>
    [
      r.customerNumber,
      r.companyName,
      r.name,
      r.phone ?? "",
      r.email ?? "",
      r.city,
      r.country,
      r.siret ?? "",
      r.vatNumber ?? "",
      r.totalInvoiced.toFixed(2),
      r.totalPaid.toFixed(2),
      r.balanceDue.toFixed(2),
      r.lastInvoiceDate ? new Date(r.lastInvoiceDate).toLocaleDateString("fr-FR") : "",
      r.status,
    ].join(";"),
  );
  return [header, ...lines].join("\n");
}

export async function getAllTagsQuery(organizationId: string) {
  return prisma.customerTag.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
}

export function filterCustomersByText<T extends {
  name: string;
  customerNumber: string;
  email: string | null;
  status: string;
  type: string;
}>(
  customers: T[],
  filters: { q?: string; status?: string; type?: string },
): T[] {
  return customers.filter((c) => {
    if (filters.status && c.status !== filters.status) return false;
    if (filters.type && c.type !== filters.type) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const haystack = [c.name, c.customerNumber, c.email ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function filterCustomersByTag<T extends { tagAssignments?: { tagId: string }[] }>(
  customers: T[],
  tagId?: string,
): T[] {
  if (!tagId) return customers;
  return customers.filter((c) =>
    c.tagAssignments?.some((a) => a.tagId === tagId),
  );
}
