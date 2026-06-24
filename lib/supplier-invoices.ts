import type { Prisma } from "@prisma/client";
import { hasFilterValue } from "@/lib/filter-params";
import type { SupplierInvoiceFilterInput } from "@/lib/supplier-invoice-validators";
import { prisma } from "@/lib/prisma";
import { isSupplierInvoiceOverdue } from "@/lib/supplier-invoice-status";
import { moneyToNumber } from "@/lib/money";

function safeDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const defaultInclude = {
  supplier: { select: { id: true, name: true, supplierNumber: true } },
  expenseCategory: true,
} satisfies Prisma.SupplierInvoiceInclude;

export function buildSupplierInvoiceWhere(
  organizationId: string,
  filters: Partial<SupplierInvoiceFilterInput>,
): Prisma.SupplierInvoiceWhereInput {
  const archivedFilter = filters.archived ?? "false";
  const issueDateFrom = safeDate(filters.issueDateFrom);
  const issueDateTo = safeDate(filters.issueDateTo);
  const dueDateFrom = safeDate(filters.dueDateFrom);
  const dueDateTo = safeDate(filters.dueDateTo);

  return {
    organizationId,
    ...(archivedFilter === "false" ? { isArchived: false } : {}),
    ...(archivedFilter === "only" ? { isArchived: true } : {}),
    ...(hasFilterValue(filters.status)
      ? { status: filters.status as Prisma.EnumSupplierInvoiceStatusFilter["equals"] }
      : {}),
    ...(filters.paymentStatus
      ? { paymentStatus: filters.paymentStatus as Prisma.EnumSupplierInvoicePaymentStatusFilter["equals"] }
      : {}),
    ...(hasFilterValue(filters.supplierId) ? { supplierId: filters.supplierId } : {}),
    ...(hasFilterValue(filters.expenseCategoryId)
      ? { expenseCategoryId: filters.expenseCategoryId }
      : {}),
    ...(hasFilterValue(filters.type)
      ? { type: filters.type as Prisma.EnumSupplierInvoiceTypeFilter["equals"] }
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
    ...(filters.minAmount !== undefined || filters.maxAmount !== undefined
      ? {
          totalIncludingTax: {
            ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
            ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { supplierInvoiceNumber: { contains: filters.q, mode: "insensitive" } },
            { supplierReference: { contains: filters.q, mode: "insensitive" } },
            { title: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
            { internalNotes: { contains: filters.q, mode: "insensitive" } },
            { supplier: { name: { contains: filters.q, mode: "insensitive" } } },
            { supplier: { supplierNumber: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listSupplierInvoicesQuery(
  organizationId: string,
  filters: Partial<SupplierInvoiceFilterInput>,
) {
  const parsed = {
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 20,
    sortBy: filters.sortBy ?? "createdAt",
    sortOrder: filters.sortOrder ?? "desc",
  };

  let where = buildSupplierInvoiceWhere(organizationId, filters);

  if (filters.overdue === "true") {
    const candidates = await prisma.supplierInvoice.findMany({
      where: { ...where, status: "VALIDATED", amountDue: { gt: 0 } },
      select: { id: true, dueDate: true, amountDue: true },
    });
    const overdueIds = candidates
      .filter((i) => isSupplierInvoiceOverdue(i.dueDate, i.amountDue))
      .map((i) => i.id);
    where = { ...where, id: { in: overdueIds.length > 0 ? overdueIds : ["__none__"] } };
  }

  const skip = (parsed.page - 1) * parsed.pageSize;

  const [invoices, total] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where,
      include: defaultInclude,
      orderBy: { [parsed.sortBy]: parsed.sortOrder },
      skip,
      take: parsed.pageSize,
    }),
    prisma.supplierInvoice.count({ where }),
  ]);

  return {
    invoices,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.ceil(total / parsed.pageSize),
  };
}

export type SupplierInvoiceGridRow = {
  id: string;
  supplierInvoiceNumber: string;
  status: string;
  paymentStatus: string;
  issueDate: string;
  dueDate: string;
  supplierId: string;
  supplierName: string;
  companyName: string;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  amountPaid: number;
  amountDue: number;
  isOverdue: boolean;
  country: string;
  hasPdf: boolean;
  currency: string;
};

export async function listSupplierInvoicesForGridQuery(
  organizationId: string,
  filters: Partial<SupplierInvoiceFilterInput>,
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));

  const where = buildSupplierInvoiceWhere(organizationId, filters);
  const invoices = await prisma.supplierInvoice.findMany({
    where,
    select: {
      id: true,
      supplierInvoiceNumber: true,
      status: true,
      paymentStatus: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      totalExcludingTax: true,
      totalVatAmount: true,
      totalIncludingTax: true,
      amountPaid: true,
      amountDue: true,
      supplier: {
        select: {
          id: true,
          name: true,
          legalName: true,
          displayName: true,
          addresses: { where: { isDefault: true }, take: 1, select: { country: true } },
        },
      },
      _count: { select: { attachments: true } },
    },
    orderBy: { issueDate: "desc" },
    take: 5000,
  });

  let rows: SupplierInvoiceGridRow[] = invoices.map((i) => ({
    id: i.id,
    supplierInvoiceNumber: i.supplierInvoiceNumber,
    status: i.status,
    paymentStatus: i.paymentStatus,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    supplierId: i.supplier.id,
    supplierName: i.supplier.name,
    companyName: i.supplier.legalName ?? i.supplier.displayName ?? "",
    totalExcludingTax: moneyToNumber(i.totalExcludingTax),
    totalVatAmount: moneyToNumber(i.totalVatAmount),
    totalIncludingTax: moneyToNumber(i.totalIncludingTax),
    amountPaid: moneyToNumber(i.amountPaid),
    amountDue: moneyToNumber(i.amountDue),
    isOverdue: i.status === "VALIDATED" && isSupplierInvoiceOverdue(i.dueDate, i.amountDue),
    country: i.supplier.addresses[0]?.country ?? "",
    hasPdf: i._count.attachments > 0,
    currency: i.currency,
  }));

  if (filters.overdue === "true") rows = rows.filter((r) => r.isOverdue);

  const total = rows.length;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    rows: paged,
    allRows: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function buildSupplierInvoicesGridCsv(rows: SupplierInvoiceGridRow[]): string {
  const header = [
    "N° facture fournisseur",
    "Statut",
    "Date facture",
    "Date échéance",
    "Fournisseur",
    "Société",
    "Total HT",
    "Total TVA",
    "Total TTC",
    "Déjà payé",
    "Solde dû",
    "Pays",
    "Document PDF",
  ].join(";");
  const lines = rows.map((r) =>
    [
      r.supplierInvoiceNumber,
      r.status,
      new Date(r.issueDate).toLocaleDateString("fr-FR"),
      new Date(r.dueDate).toLocaleDateString("fr-FR"),
      r.supplierName,
      r.companyName,
      r.totalExcludingTax.toFixed(2),
      r.totalVatAmount.toFixed(2),
      r.totalIncludingTax.toFixed(2),
      r.amountPaid.toFixed(2),
      r.amountDue.toFixed(2),
      r.country,
      r.hasPdf ? "Oui" : "Non",
    ].join(";"),
  );
  return [header, ...lines].join("\n");
}

export async function getSupplierInvoiceByIdQuery(organizationId: string, id: string) {
  return prisma.supplierInvoice.findFirst({
    where: { id, organizationId },
    include: {
      supplier: true,
      expenseCategory: true,
      lines: {
        include: { expenseCategory: true },
        orderBy: { position: "asc" },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getSupplierInvoiceStatsQuery(organizationId: string) {
  return prisma.supplierInvoice.findMany({
    where: { organizationId },
    include: {
      supplier: { select: { id: true, name: true } },
      expenseCategory: { select: { name: true } },
    },
  });
}

export async function getSupplierInvoicesForExportQuery(
  organizationId: string,
  filters: Partial<SupplierInvoiceFilterInput>,
) {
  return prisma.supplierInvoice.findMany({
    where: buildSupplierInvoiceWhere(organizationId, filters),
    include: {
      supplier: { select: { name: true } },
      expenseCategory: { select: { name: true } },
    },
    orderBy: { issueDate: "desc" },
  });
}

export async function getSupplierInvoicesBySupplierQuery(
  organizationId: string,
  supplierId: string,
  limit = 10,
) {
  return prisma.supplierInvoice.findMany({
    where: { organizationId, supplierId, isArchived: false },
    include: { expenseCategory: true },
    orderBy: { issueDate: "desc" },
    take: limit,
  });
}

export async function getSupplierInvoiceFormDataQuery(organizationId: string) {
  const [suppliers, expenseCategories] = await Promise.all([
    prisma.supplier.findMany({
      where: { organizationId, isArchived: false, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        name: true,
        supplierNumber: true,
        defaultPaymentTermsDays: true,
        defaultVatRate: true,
        currency: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.expenseCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return { suppliers, expenseCategories };
}
