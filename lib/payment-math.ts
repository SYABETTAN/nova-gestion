import type { InvoicePaymentStatus, InvoiceStatus } from "@prisma/client";
import {
  isZero,
  money,
  moneyAdd,
  moneyClamp,
  moneyMin,
  moneySub,
  moneyToNumber,
  roundMoney,
  type MoneyInput,
} from "@/lib/money";
import { isInvoiceOverdue } from "@/lib/invoice-status";

export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = [
  "VALIDATED",
  "SENT",
  "OVERDUE",
  "PARTIALLY_PAID",
];

export function getInvoiceRemainingAmount(invoice: {
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
}): number {
  return moneyToNumber(
    roundMoney(
      moneyClamp(
        moneySub(invoice.totalIncludingTax, invoice.amountPaid),
        0,
        Number.MAX_SAFE_INTEGER,
      ),
    ),
  );
}

export function getPaymentRemainingAmount(payment: {
  amount: MoneyInput;
  allocatedAmount: MoneyInput;
}): number {
  return moneyToNumber(
    roundMoney(
      moneyClamp(
        moneySub(payment.amount, payment.allocatedAmount),
        0,
        Number.MAX_SAFE_INTEGER,
      ),
    ),
  );
}

export function canInvoiceReceivePayment(status: InvoiceStatus): boolean {
  return OPEN_INVOICE_STATUSES.includes(status);
}

export function computeInvoicePaymentFields(
  invoice: {
    totalIncludingTax: MoneyInput;
    dueDate: Date;
    status: InvoiceStatus;
    sentAt?: Date | null;
  },
  amountPaid: MoneyInput,
  now: Date = new Date(),
): {
  amountPaid: number;
  amountDue: number;
  paymentStatus: InvoicePaymentStatus;
  status: InvoiceStatus;
  paidAt: Date | null;
} {
  const total = roundMoney(invoice.totalIncludingTax);
  const paid = roundMoney(moneyClamp(amountPaid, 0, total));
  const amountDue = roundMoney(moneySub(total, paid));

  let paymentStatus: InvoicePaymentStatus;
  if (isZero(amountDue) && !isZero(paid)) {
    paymentStatus = "PAID";
  } else if (!isZero(paid) && !isZero(amountDue)) {
    paymentStatus = "PARTIALLY_PAID";
  } else if (isInvoiceOverdue(invoice.dueDate, "UNPAID", now)) {
    paymentStatus = "OVERDUE";
  } else {
    paymentStatus = "UNPAID";
  }

  let status = invoice.status;
  if (isZero(amountDue) && !isZero(paid)) {
    status = "PAID";
  } else if (!isZero(paid) && !isZero(amountDue)) {
    status = "PARTIALLY_PAID";
  } else if (
    !isZero(amountDue) &&
    isInvoiceOverdue(invoice.dueDate, paymentStatus, now) &&
    !["CANCELLED", "CREDITED", "DRAFT"].includes(invoice.status)
  ) {
    status = "OVERDUE";
  } else if (
    ["PAID", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) &&
    isZero(paid)
  ) {
    status = invoice.sentAt ? "SENT" : "VALIDATED";
  }

  return {
    amountPaid: moneyToNumber(paid),
    amountDue: moneyToNumber(amountDue),
    paymentStatus,
    status,
    paidAt: isZero(amountDue) && !isZero(paid) ? now : null,
  };
}

type InvoiceForAuto = {
  id: string;
  dueDate: Date;
  issueDate: Date;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
};

function isPositive(value: ReturnType<typeof roundMoney>): boolean {
  return value.greaterThan(0);
}

export function buildAutoAllocations(
  paymentAmount: MoneyInput,
  invoices: InvoiceForAuto[],
): { invoiceId: string; amount: number }[] {
  const sorted = [...invoices].sort((a, b) => {
    const dueDiff = a.dueDate.getTime() - b.dueDate.getTime();
    if (dueDiff !== 0) return dueDiff;
    return a.issueDate.getTime() - b.issueDate.getTime();
  });

  let remaining = roundMoney(paymentAmount);
  const allocations: { invoiceId: string; amount: number }[] = [];

  for (const invoice of sorted) {
    if (isZero(remaining)) break;
    const invoiceRemaining = roundMoney(
      moneySub(invoice.totalIncludingTax, invoice.amountPaid),
    );
    if (!isPositive(invoiceRemaining)) continue;
    const amount = roundMoney(moneyMin(remaining, invoiceRemaining));
    if (isZero(amount)) continue;
    allocations.push({ invoiceId: invoice.id, amount: moneyToNumber(amount) });
    remaining = roundMoney(moneySub(remaining, amount));
  }

  return allocations;
}

export function computeCustomerOutstanding(
  invoices: { status: InvoiceStatus; amountDue: MoneyInput }[],
): number {
  return moneyToNumber(
    roundMoney(
      invoices
        .filter(
          (i) =>
            !["PAID", "CANCELLED", "CREDITED", "DRAFT"].includes(i.status),
        )
        .reduce((sum, i) => moneyAdd(sum, i.amountDue), money(0)),
    ),
  );
}
