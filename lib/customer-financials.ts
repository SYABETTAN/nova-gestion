import type { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isInvoiceOverdue } from "@/lib/invoice-status";
import { moneyAdd, moneyToNumber, roundMoney, type MoneyInput } from "@/lib/money";

const BILLED_STATUSES: InvoiceStatus[] = [
  "VALIDATED",
  "SENT",
  "OVERDUE",
  "PARTIALLY_PAID",
  "PAID",
];

const OPEN_STATUSES: InvoiceStatus[] = [
  "VALIDATED",
  "SENT",
  "OVERDUE",
  "PARTIALLY_PAID",
];

export type CustomerFinancialSummary = {
  totalInvoiced: number;
  totalPaid: number;
  totalDue: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  currency: string;
};

export async function getCustomerFinancialSummaryQuery(
  organizationId: string,
  customerId: string,
): Promise<CustomerFinancialSummary> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { currency: true },
  });
  if (!customer) {
    return {
      totalInvoiced: 0,
      totalPaid: 0,
      totalDue: 0,
      openInvoiceCount: 0,
      overdueInvoiceCount: 0,
      currency: "EUR",
    };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      customerId,
      isArchived: false,
      status: { in: BILLED_STATUSES },
    },
    select: {
      status: true,
      paymentStatus: true,
      totalIncludingTax: true,
      amountPaid: true,
      amountDue: true,
      dueDate: true,
    },
  });

  const now = new Date();
  let totalInvoiced = roundMoney(0);
  let totalPaid = roundMoney(0);
  let totalDue = roundMoney(0);
  let openInvoiceCount = 0;
  let overdueInvoiceCount = 0;

  for (const invoice of invoices) {
    totalInvoiced = roundMoney(moneyAdd(totalInvoiced, invoice.totalIncludingTax));
    totalPaid = roundMoney(moneyAdd(totalPaid, invoice.amountPaid));
    const due = moneyToNumber(invoice.amountDue);
    if (OPEN_STATUSES.includes(invoice.status) && due > 0) {
      totalDue = roundMoney(moneyAdd(totalDue, invoice.amountDue));
      openInvoiceCount += 1;
      if (isInvoiceOverdue(invoice.dueDate, invoice.paymentStatus, now)) {
        overdueInvoiceCount += 1;
      }
    }
  }

  return {
    totalInvoiced: moneyToNumber(totalInvoiced),
    totalPaid: moneyToNumber(totalPaid),
    totalDue: moneyToNumber(totalDue),
    openInvoiceCount,
    overdueInvoiceCount,
    currency: customer.currency,
  };
}

export function sumAmountDue(
  invoices: { status: InvoiceStatus; amountDue: MoneyInput }[],
): number {
  return moneyToNumber(
    roundMoney(
      invoices
        .filter((i) => OPEN_STATUSES.includes(i.status))
        .reduce((sum, i) => moneyAdd(sum, i.amountDue), roundMoney(0)),
    ),
  );
}
