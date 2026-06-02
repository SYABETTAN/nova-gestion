import type { Prisma } from "@prisma/client";
import { hasFilterValue } from "@/lib/filter-params";
import type { CustomerFilterInput } from "@/lib/customer-validators";
import { prisma } from "@/lib/prisma";

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
