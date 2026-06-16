import "server-only";

import type { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canInvoiceReceivePayment } from "@/lib/payment-math";
import { moneyToNumber } from "@/lib/money";
import type { InvoicePaymentPrefillError } from "@/lib/payment-prefill-messages";

export type { InvoicePaymentPrefillError } from "@/lib/payment-prefill-messages";
export { invoicePaymentPrefillErrorMessage } from "@/lib/payment-prefill-messages";

export type InvoicePaymentPrefill =
  | { ok: false; error: InvoicePaymentPrefillError; status?: InvoiceStatus }
  | {
      ok: true;
      customerId: string;
      customerName: string;
      invoiceId: string;
      invoiceNumber: string;
      amount: number;
      amountPaid: number;
      totalIncludingTax: number;
      amountDue: number;
      currency: string;
    };

export async function getInvoicePaymentPrefillQuery(
  organizationId: string,
  invoiceId: string,
): Promise<InvoicePaymentPrefill> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      customer: { select: { id: true, name: true, isArchived: true } },
    },
  });

  if (!invoice) return { ok: false, error: "NOT_FOUND" };
  if (invoice.isArchived) return { ok: false, error: "ARCHIVED" };
  if (invoice.status === "PAID") return { ok: false, error: "ALREADY_PAID", status: invoice.status };
  if (!canInvoiceReceivePayment(invoice.status)) {
    return { ok: false, error: "NOT_PAYABLE", status: invoice.status };
  }

  const amountDue = moneyToNumber(invoice.amountDue);
  if (amountDue <= 0) return { ok: false, error: "ZERO_DUE", status: invoice.status };

  return {
    ok: true,
    customerId: invoice.customerId,
    customerName: invoice.customer.name,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: amountDue,
    amountPaid: moneyToNumber(invoice.amountPaid),
    totalIncludingTax: moneyToNumber(invoice.totalIncludingTax),
    amountDue,
    currency: invoice.currency,
  };
}
