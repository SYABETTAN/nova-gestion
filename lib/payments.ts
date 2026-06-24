import "server-only";

import type { Prisma } from "@prisma/client";
import type { PaymentFilterInput } from "@/lib/payment-validators";
import { prisma } from "@/lib/prisma";
import { moneyToNumber } from "@/lib/money";

const defaultInclude = {
  customer: { select: { id: true, name: true, customerNumber: true, email: true } },
  receivedBy: { select: { id: true, name: true } },
  allocations: {
    orderBy: { allocatedAt: "desc" as const },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          totalIncludingTax: true,
          amountPaid: true,
          amountDue: true,
          paymentStatus: true,
          status: true,
          currency: true,
        },
      },
    },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    include: { user: { select: { id: true, name: true } } },
  },
} satisfies Prisma.PaymentInclude;

export function buildPaymentWhere(
  organizationId: string,
  filters: Partial<PaymentFilterInput>,
): Prisma.PaymentWhereInput {
  return {
    organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.method ? { method: filters.method } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.unallocated === "true" ? { unallocatedAmount: { gt: 0 } } : {}),
    ...(filters.cancelled === "true"
      ? { status: "CANCELLED" }
      : filters.cancelled === "false"
        ? { status: { not: "CANCELLED" } }
        : {}),
    ...(filters.paymentDateFrom || filters.paymentDateTo
      ? {
          paymentDate: {
            ...(filters.paymentDateFrom
              ? { gte: new Date(filters.paymentDateFrom) }
              : {}),
            ...(filters.paymentDateTo
              ? { lte: new Date(filters.paymentDateTo) }
              : {}),
          },
        }
      : {}),
    ...(filters.amountMin !== undefined || filters.amountMax !== undefined
      ? {
          amount: {
            ...(filters.amountMin !== undefined ? { gte: filters.amountMin } : {}),
            ...(filters.amountMax !== undefined ? { lte: filters.amountMax } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { paymentNumber: { contains: filters.q } },
            { reference: { contains: filters.q } },
            { bankReference: { contains: filters.q } },
            { checkNumber: { contains: filters.q } },
            { notes: { contains: filters.q } },
            { customer: { name: { contains: filters.q } } },
          ],
        }
      : {}),
  };
}

function buildOrderBy(
  filters: Partial<PaymentFilterInput>,
): Prisma.PaymentOrderByWithRelationInput {
  const order = filters.sortOrder ?? "desc";
  switch (filters.sortBy) {
    case "createdAt":
      return { createdAt: order };
    case "amount":
      return { amount: order };
    case "unallocatedAmount":
      return { unallocatedAmount: order };
    case "customer":
      return { customer: { name: order } };
    case "status":
      return { status: order };
    case "method":
      return { method: order };
    default:
      return { paymentDate: order };
  }
}

export type PaymentGridRow = {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  customerId: string | null;
  customerName: string;
  companyName: string;
  linkedInvoices: string;
  firstInvoiceId: string | null;
  method: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  status: string;
  bankReference: string | null;
  reference: string | null;
  notes: string | null;
  currency: string;
};

export async function listPaymentsForGridQuery(
  organizationId: string,
  filters: Partial<PaymentFilterInput> & { partial?: string },
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));

  const base = buildPaymentWhere(organizationId, filters);
  const and: Prisma.PaymentWhereInput[] = [base];
  if (filters.partial === "true") {
    and.push({ allocatedAmount: { gt: 0 }, unallocatedAmount: { gt: 0 } });
  }
  const where: Prisma.PaymentWhereInput = { AND: and };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        paymentNumber: true,
        paymentDate: true,
        method: true,
        status: true,
        amount: true,
        allocatedAmount: true,
        unallocatedAmount: true,
        bankReference: true,
        reference: true,
        notes: true,
        currency: true,
        customer: { select: { id: true, name: true, legalName: true, displayName: true } },
        allocations: { select: { invoice: { select: { id: true, invoiceNumber: true } } } },
      },
      orderBy: { paymentDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
  ]);

  const rows: PaymentGridRow[] = payments.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    paymentDate: p.paymentDate.toISOString(),
    customerId: p.customer?.id ?? null,
    customerName: p.customer?.name ?? "—",
    companyName: p.customer?.legalName ?? p.customer?.displayName ?? "",
    linkedInvoices: p.allocations
      .map((a) => a.invoice?.invoiceNumber)
      .filter(Boolean)
      .join(", "),
    firstInvoiceId: p.allocations.find((a) => a.invoice?.id)?.invoice?.id ?? null,
    method: p.method,
    amount: moneyToNumber(p.amount),
    allocatedAmount: moneyToNumber(p.allocatedAmount),
    unallocatedAmount: moneyToNumber(p.unallocatedAmount),
    status: p.status,
    bankReference: p.bankReference,
    reference: p.reference,
    notes: p.notes,
    currency: p.currency,
  }));

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function buildPaymentsGridCsv(rows: PaymentGridRow[]): string {
  const header = [
    "N° règlement",
    "Date",
    "Client",
    "Société",
    "Facture(s) liée(s)",
    "Mode",
    "Montant",
    "Montant affecté",
    "Reste à affecter",
    "Statut",
    "Référence bancaire",
    "Notes",
  ].join(";");
  const lines = rows.map((r) =>
    [
      r.paymentNumber,
      new Date(r.paymentDate).toLocaleDateString("fr-FR"),
      r.customerName,
      r.companyName,
      r.linkedInvoices,
      r.method,
      r.amount.toFixed(2),
      r.allocatedAmount.toFixed(2),
      r.unallocatedAmount.toFixed(2),
      r.status,
      r.bankReference ?? "",
      (r.notes ?? "").replace(/[\n;]/g, " "),
    ].join(";"),
  );
  return [header, ...lines].join("\n");
}

export async function listPaymentsQuery(
  organizationId: string,
  filters: Partial<PaymentFilterInput>,
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const where = buildPaymentWhere(organizationId, filters);

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerNumber: true } },
      },
      orderBy: buildOrderBy(filters),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getPaymentByIdQuery(organizationId: string, id: string) {
  return prisma.payment.findFirst({
    where: { id, organizationId },
    include: defaultInclude,
  });
}

export async function getPaymentsForExportQuery(
  organizationId: string,
  filters: Partial<PaymentFilterInput>,
) {
  return prisma.payment.findMany({
    where: buildPaymentWhere(organizationId, filters),
    include: { customer: { select: { name: true } } },
    orderBy: { paymentDate: "desc" },
  });
}

export async function getPaymentStatsQuery(organizationId: string) {
  const payments = await prisma.payment.findMany({
    where: { organizationId },
    select: {
      status: true,
      amount: true,
      allocatedAmount: true,
      unallocatedAmount: true,
      method: true,
      paymentDate: true,
    },
  });

  const paidInvoices = await prisma.invoice.count({
    where: { organizationId, status: "PAID", isArchived: false },
  });

  const totalOutstanding = await prisma.customer.aggregate({
    where: { organizationId, isArchived: false },
    _sum: { outstandingAmount: true },
  });

  return { payments, paidInvoices, totalOutstanding: totalOutstanding._sum.outstandingAmount ?? 0 };
}

export async function getPaymentsByInvoiceQuery(
  organizationId: string,
  invoiceId: string,
) {
  return prisma.paymentAllocation.findMany({
    where: { organizationId, invoiceId, payment: { status: { not: "CANCELLED" } } },
    include: {
      payment: {
        select: {
          id: true,
          paymentNumber: true,
          paymentDate: true,
          method: true,
          status: true,
          amount: true,
          currency: true,
        },
      },
    },
    orderBy: { allocatedAt: "desc" },
  });
}

export async function getRecentPaymentsByCustomerQuery(
  organizationId: string,
  customerId: string,
  limit = 10,
) {
  return prisma.payment.findMany({
    where: { organizationId, customerId, status: { not: "CANCELLED" } },
    orderBy: { paymentDate: "desc" },
    take: limit,
    select: {
      id: true,
      paymentNumber: true,
      paymentDate: true,
      amount: true,
      allocatedAmount: true,
      unallocatedAmount: true,
      status: true,
      method: true,
      currency: true,
    },
  });
}

export async function getCustomersForPaymentFilterQuery(organizationId: string) {
  return prisma.customer.findMany({
    where: { organizationId, isArchived: false },
    select: { id: true, name: true, outstandingAmount: true, currency: true },
    orderBy: { name: "asc" },
  });
}

export async function getPaymentFormDataQuery(organizationId: string) {
  const [customers, organization] = await Promise.all([
    getCustomersForPaymentFilterQuery(organizationId),
    prisma.organization.findUnique({ where: { id: organizationId } }),
  ]);
  return { customers, organization };
}

export async function getPaymentFormDataWithPrefillQuery(
  organizationId: string,
  prefilledCustomerId?: string,
) {
  const { customers, organization } = await getPaymentFormDataQuery(organizationId);
  if (!prefilledCustomerId || customers.some((c) => c.id === prefilledCustomerId)) {
    return { customers, organization };
  }

  const extra = await prisma.customer.findFirst({
    where: { id: prefilledCustomerId, organizationId },
    select: { id: true, name: true, outstandingAmount: true, currency: true },
  });
  if (!extra) return { customers, organization };

  return {
    customers: [extra, ...customers],
    organization,
  };
}
