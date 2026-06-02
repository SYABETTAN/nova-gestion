import type { Prisma } from "@prisma/client";
import { hasFilterValue } from "@/lib/filter-params";
import type { SupplierFilterInput } from "@/lib/supplier-validators";
import { prisma } from "@/lib/prisma";

const defaultInclude = {
  category: true,
  tagAssignments: { include: { tag: true } },
  addresses: true,
} satisfies Prisma.SupplierInclude;

export function buildSupplierWhere(
  organizationId: string,
  filters: Partial<SupplierFilterInput>,
): Prisma.SupplierWhereInput {
  const archivedFilter = filters.archived ?? "false";

  return {
    organizationId,
    ...(archivedFilter === "false" && filters.status !== "ARCHIVED"
      ? { isArchived: false }
      : {}),
    ...(archivedFilter === "only" ? { isArchived: true } : {}),
    ...(hasFilterValue(filters.status) && filters.status !== "ARCHIVED"
      ? { status: filters.status as Prisma.EnumSupplierStatusFilter["equals"] }
      : {}),
    ...(filters.status === "ARCHIVED" ? { status: "ARCHIVED", isArchived: true } : {}),
    ...(hasFilterValue(filters.type)
      ? { type: filters.type as Prisma.EnumSupplierTypeFilter["equals"] }
      : {}),
    ...(hasFilterValue(filters.categoryId) ? { categoryId: filters.categoryId } : {}),
    ...(hasFilterValue(filters.riskLevel)
      ? { riskLevel: filters.riskLevel as Prisma.EnumSupplierRiskLevelFilter["equals"] }
      : {}),
    ...(filters.preferred === "true" ? { isPreferred: true } : {}),
    ...(hasFilterValue(filters.city)
      ? { addresses: { some: { city: { contains: filters.city, mode: "insensitive" } } } }
      : {}),
    ...(hasFilterValue(filters.tagId)
      ? { tagAssignments: { some: { tagId: filters.tagId } } }
      : {}),
    ...(hasFilterValue(filters.q)
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { displayName: { contains: filters.q, mode: "insensitive" } },
            { supplierNumber: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
            { phone: { contains: filters.q, mode: "insensitive" } },
            { siret: { contains: filters.q, mode: "insensitive" } },
            { vatNumber: { contains: filters.q, mode: "insensitive" } },
            { legalName: { contains: filters.q, mode: "insensitive" } },
            { notes: { contains: filters.q, mode: "insensitive" } },
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
}

export function buildSupplierOrderBy(
  sortBy: SupplierFilterInput["sortBy"] = "createdAt",
  sortOrder: SupplierFilterInput["sortOrder"] = "desc",
): Prisma.SupplierOrderByWithRelationInput {
  return { [sortBy]: sortOrder };
}

export async function listSuppliersQuery(
  organizationId: string,
  filters: Partial<SupplierFilterInput>,
) {
  const parsed = {
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 20,
    sortBy: filters.sortBy ?? "createdAt",
    sortOrder: filters.sortOrder ?? "desc",
  };

  const where = buildSupplierWhere(organizationId, filters);
  const skip = (parsed.page - 1) * parsed.pageSize;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: defaultInclude,
      orderBy: buildSupplierOrderBy(parsed.sortBy, parsed.sortOrder),
      skip,
      take: parsed.pageSize,
    }),
    prisma.supplier.count({ where }),
  ]);

  return {
    suppliers,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.ceil(total / parsed.pageSize),
  };
}

export async function getSupplierByIdQuery(organizationId: string, id: string) {
  return prisma.supplier.findFirst({
    where: { id, organizationId },
    include: {
      category: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] },
      addresses: { orderBy: [{ isDefault: "desc" }, { type: "asc" }] },
      bankAccounts: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      supplierNotes: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      tagAssignments: { include: { tag: true } },
      activities: { orderBy: { activityDate: "desc" } },
    },
  });
}

export async function getSupplierStatsQuery(organizationId: string) {
  const [suppliers, categoryGroups] = await Promise.all([
    prisma.supplier.findMany({
      where: { organizationId },
      select: {
        status: true,
        outstandingAmount: true,
        totalPurchasesAmount: true,
        isArchived: true,
        isPreferred: true,
        riskLevel: true,
        defaultPaymentTermsDays: true,
        categoryId: true,
      },
    }),
    prisma.supplier.groupBy({
      by: ["categoryId"],
      where: { organizationId, isArchived: false, categoryId: { not: null } },
      _count: { categoryId: true },
    }),
  ]);

  const categories = await prisma.supplierCategory.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const topCategories = categoryGroups
    .map((g) => ({
      id: g.categoryId!,
      name: categoryMap.get(g.categoryId!) ?? "—",
      count: g._count.categoryId,
    }))
    .sort((a, b) => b.count - a.count);

  return { suppliers, topCategories };
}

export async function getAllSupplierTagsQuery(organizationId: string) {
  return prisma.supplierTag.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
}

export async function getSupplierCategoriesQuery(organizationId: string) {
  return prisma.supplierCategory.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listSuppliersForExportQuery(
  organizationId: string,
  filters: Partial<SupplierFilterInput>,
) {
  return prisma.supplier.findMany({
    where: buildSupplierWhere(organizationId, filters),
    include: {
      category: true,
      addresses: { where: { isDefault: true }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
}
