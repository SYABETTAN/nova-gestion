import "server-only";

import type { PaymentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  money,
  moneyAdd,
  moneyClamp,
  moneySub,
  moneyToNumber,
  roundMoney,
  toDbDecimal,
} from "@/lib/money";
import { computePaymentStatusFromAmounts } from "@/lib/payment-status";

export {
  OPEN_INVOICE_STATUSES,
  buildAutoAllocations,
  canInvoiceReceivePayment,
  computeCustomerOutstanding,
  computeInvoicePaymentFields,
  getInvoiceRemainingAmount,
  getPaymentRemainingAmount,
} from "@/lib/payment-math";

import {
  computeCustomerOutstanding,
  computeInvoicePaymentFields,
  OPEN_INVOICE_STATUSES,
} from "@/lib/payment-math";

type DbClient = Prisma.TransactionClient | typeof prisma;

async function sumInvoiceAllocations(
  invoiceId: string,
  organizationId: string,
  db: DbClient,
): Promise<number> {
  const allocations = await db.paymentAllocation.findMany({
    where: {
      invoiceId,
      organizationId,
      payment: { status: { not: "CANCELLED" } },
    },
    select: { amount: true },
  });
  return moneyToNumber(
    roundMoney(allocations.reduce((sum, a) => moneyAdd(sum, a.amount), money(0))),
  );
}

export async function recalculateInvoicePaymentStatus(
  invoiceId: string,
  organizationId: string,
  db: DbClient = prisma,
): Promise<void> {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId },
  });
  if (!invoice) return;

  const amountPaid = await sumInvoiceAllocations(invoiceId, organizationId, db);
  const fields = computeInvoicePaymentFields(
    {
      totalIncludingTax: invoice.totalIncludingTax,
      dueDate: invoice.dueDate,
      status: invoice.status,
      sentAt: invoice.sentAt,
    },
    amountPaid,
  );

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: toDbDecimal(fields.amountPaid),
      amountDue: toDbDecimal(fields.amountDue),
      paymentStatus: fields.paymentStatus,
      status: fields.status,
      paidAt: fields.paidAt ?? (fields.amountDue > 0 ? null : invoice.paidAt),
    },
  });
}

export async function recalculatePaymentAllocationStatus(
  paymentId: string,
  organizationId: string,
  db: DbClient = prisma,
): Promise<void> {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, organizationId },
  });
  if (!payment || payment.status === "CANCELLED") return;

  const allocations = await db.paymentAllocation.findMany({
    where: { paymentId, organizationId },
    select: { amount: true },
  });
  const allocatedAmount = roundMoney(
    allocations.reduce((sum, a) => moneyAdd(sum, a.amount), money(0)),
  );
  const unallocatedAmount = roundMoney(
    moneyClamp(moneySub(payment.amount, allocatedAmount), 0, Number.MAX_SAFE_INTEGER),
  );
  const status = computePaymentStatusFromAmounts(
    moneyToNumber(payment.amount),
    moneyToNumber(allocatedAmount),
  ) as PaymentStatus;

  await db.payment.update({
    where: { id: paymentId },
    data: {
      allocatedAmount: toDbDecimal(allocatedAmount),
      unallocatedAmount: toDbDecimal(unallocatedAmount),
      status,
    },
  });
}

export async function recalculateCustomerOutstandingAmount(
  customerId: string,
  organizationId: string,
  db: DbClient = prisma,
): Promise<number> {
  const invoices = await db.invoice.findMany({
    where: { customerId, organizationId, isArchived: false },
    select: { status: true, amountDue: true },
  });
  const outstanding = computeCustomerOutstanding(invoices);
  await db.customer.update({
    where: { id: customerId },
    data: { outstandingAmount: toDbDecimal(outstanding) },
  });
  return outstanding;
}

export async function getOpenInvoicesForCustomerQuery(
  customerId: string,
  organizationId: string,
  db: DbClient = prisma,
) {
  return db.invoice.findMany({
    where: {
      customerId,
      organizationId,
      isArchived: false,
      status: { in: OPEN_INVOICE_STATUSES },
    },
    orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      totalIncludingTax: true,
      amountPaid: true,
      amountDue: true,
      status: true,
      paymentStatus: true,
      currency: true,
    },
  });
}
