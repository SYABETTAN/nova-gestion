import {
  PaymentActivityType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
} from "@prisma/client";
import {
  recalculateCustomerOutstandingAmount,
  recalculateInvoicePaymentStatus,
} from "../lib/payment-calculations";
import {
  isPositive,
  isZero,
  moneyAdd,
  moneySub,
  moneyToNumber,
  toDbDecimal,
} from "../lib/money";
import { mapMoneyFieldsToDb, PAYMENT_MONEY_FIELDS } from "../lib/money-db";
import { roundMoney } from "../lib/pricing";

const METHOD_DISTRIBUTION: PaymentMethod[] = [
  ...Array(22).fill("BANK_TRANSFER"),
  ...Array(12).fill("CARD"),
  ...Array(8).fill("CHECK"),
  ...Array(7).fill("CASH"),
  ...Array(4).fill("DIRECT_DEBIT"),
  ...Array(2).fill("OTHER"),
] as PaymentMethod[];

const STATUS_DISTRIBUTION: PaymentStatus[] = [
  ...Array(5).fill("CONFIRMED"),
  ...Array(12).fill("PARTIALLY_ALLOCATED"),
  ...Array(34).fill("FULLY_ALLOCATED"),
  ...Array(4).fill("CANCELLED"),
] as PaymentStatus[];

const REFERENCES: Record<PaymentMethod, string[]> = {
  BANK_TRANSFER: ["VIR-2026-000145", "VIR-DEMO-8821", "REGLEMENT-CLIENT-ALPHA"],
  CARD: ["CB-DEMO-9281", "CB-2026-4412"],
  CHECK: ["CHQ-458201", "CHQ-DEMO-991"],
  CASH: ["ESP-CAISSE-001", "ESP-DEMO-042"],
  DIRECT_DEBIT: ["PREL-DEMO-032", "PREL-2026-118"],
  OTHER: ["REGLEMENT-CLIENT-ALPHA", "AUTRE-DEMO-001"],
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function methodReference(method: PaymentMethod, index: number): string {
  const refs = REFERENCES[method];
  return refs[index % refs.length];
}

function methodExtras(method: PaymentMethod, index: number) {
  if (method === "CHECK") return { checkNumber: `CHQ-${100000 + index}` };
  if (method === "CARD") return { cardLast4: String(1000 + (index % 9000)).slice(-4) };
  if (method === "BANK_TRANSFER") return { bankReference: `REF-BNK-${2026000 + index}` };
  return {};
}

export async function seedPayments(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
) {
  console.log("  Seeding payments...");

  await prisma.paymentActivity.deleteMany({ where: { organizationId } });
  await prisma.paymentAllocation.deleteMany({ where: { organizationId } });
  await prisma.payment.deleteMany({ where: { organizationId } });

  const customers = await prisma.customer.findMany({
    where: { organizationId, isArchived: false },
  });
  const invoices = await prisma.invoice.findMany({
    where: { organizationId, isArchived: false },
    orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
  });

  if (customers.length === 0) {
    console.warn("  ⚠ Skipping payments seed");
    return;
  }

  for (const inv of invoices) {
    if (["CANCELLED", "CREDITED", "DRAFT"].includes(inv.status)) continue;
    const isOverdue = inv.dueDate < new Date();
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        amountPaid: 0,
        amountDue: inv.totalIncludingTax,
        paymentStatus: isOverdue ? "OVERDUE" : "UNPAID",
        status: isOverdue ? "OVERDUE" : ["PAID", "PARTIALLY_PAID"].includes(inv.status) ? "SENT" : inv.status,
        paidAt: null,
      },
    });
  }

  const invoicesByCustomer = new Map<string, string[]>();
  for (const inv of invoices) {
    if (["CANCELLED", "CREDITED", "DRAFT"].includes(inv.status)) continue;
    const list = invoicesByCustomer.get(inv.customerId) ?? [];
    list.push(inv.id);
    invoicesByCustomer.set(inv.customerId, list);
  }

  let allocationCount = 0;
  let activityCount = 0;
  const customerInvoiceCursor = new Map<string, number>();

  for (let i = 0; i < 55; i++) {
    const customer = customers[i % customers.length];
    const method = METHOD_DISTRIBUTION[i];
    const targetStatus = STATUS_DISTRIBUTION[i];
    const paymentNumber = `REG-2026-${String(i + 1).padStart(4, "0")}`;
    const paymentDate = daysAgo(90 - i);
    const amount = roundMoney(500 + (i % 20) * 175 + (i % 7) * 42.5);
    const isCancelled = targetStatus === "CANCELLED";

    const allocations: { invoiceId: string; amount: number }[] = [];
    let allocatedAmount = 0;

    if (!isCancelled && targetStatus !== "CONFIRMED") {
      const customerInvoices = invoicesByCustomer.get(customer.id) ?? [];
      let cursor = customerInvoiceCursor.get(customer.id) ?? 0;
      const numAllocs = targetStatus === "FULLY_ALLOCATED" ? 3 + (i % 2) : 1 + (i % 3);
      let remaining =
        targetStatus === "FULLY_ALLOCATED"
          ? amount
          : roundMoney(amount * (0.5 + (i % 3) * 0.15));

      const usedInvoiceIds = new Set<string>();
      for (let j = 0; j < numAllocs && isPositive(remaining) && customerInvoices.length > 0; j++) {
        const invoiceId = customerInvoices[cursor % customerInvoices.length];
        cursor++;
        if (usedInvoiceIds.has(invoiceId)) continue;
        const fresh = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!fresh || isZero(fresh.amountDue)) continue;

        const allocAmount = roundMoney(Math.min(remaining, moneyToNumber(fresh.amountDue)));
        if (isZero(allocAmount)) continue;

        usedInvoiceIds.add(invoiceId);
        allocations.push({ invoiceId, amount: allocAmount });
        allocatedAmount = roundMoney(allocatedAmount + allocAmount);
        remaining = roundMoney(remaining - allocAmount);
      }
      customerInvoiceCursor.set(customer.id, cursor);
    }

    const unallocatedAmount = isCancelled ? 0 : roundMoney(amount - allocatedAmount);
    let status: PaymentStatus = "CONFIRMED";
    if (isCancelled) status = "CANCELLED";
    else if (isZero(allocatedAmount)) status = "CONFIRMED";
    else if (isZero(unallocatedAmount)) status = "FULLY_ALLOCATED";
    else status = "PARTIALLY_ALLOCATED";

    const paymentAmounts = mapMoneyFieldsToDb(
      {
        amount,
        allocatedAmount: isCancelled ? 0 : allocatedAmount,
        unallocatedAmount,
      },
      [...PAYMENT_MONEY_FIELDS],
    );

    const payment = await prisma.payment.create({
      data: {
        organizationId,
        paymentNumber,
        customerId: customer.id,
        status,
        method,
        paymentDate,
        ...paymentAmounts,
        currency: "EUR",
        reference: methodReference(method, i),
        notes: i % 5 === 0 ? "Règlement fictif" : null,
        internalNotes: i % 7 === 0 ? "Note interne comptable demo" : null,
        receivedById: userId,
        cancelledAt: isCancelled ? paymentDate : null,
        cancellationReason: isCancelled ? "Erreur de saisie — annulation demo" : null,
        ...methodExtras(method, i),
      },
    });

    const activities: { type: PaymentActivityType; title: string; description?: string }[] = [
      { type: "CREATED", title: "Paiement créé", description: `Paiement ${paymentNumber} enregistré` },
    ];

    if (!isCancelled) {
      for (const alloc of allocations) {
        await prisma.paymentAllocation.create({
          data: {
            organizationId,
            paymentId: payment.id,
            invoiceId: alloc.invoiceId,
            customerId: customer.id,
            amount: toDbDecimal(alloc.amount),
            allocatedAt: paymentDate,
          },
        });
        allocationCount++;
        const inv = await prisma.invoice.findUnique({ where: { id: alloc.invoiceId } });
        activities.push({
          type: "ALLOCATED",
          title: "Paiement alloué",
          description: `Facture ${inv?.invoiceNumber} — ${alloc.amount} €`,
        });
      }

      if (status === "PARTIALLY_ALLOCATED") {
        activities.push({ type: "PARTIALLY_ALLOCATED", title: "Paiement partiellement alloué" });
      }
      if (status === "FULLY_ALLOCATED") {
        activities.push({ type: "FULLY_ALLOCATED", title: "Paiement totalement alloué" });
      }
      if (i % 6 === 0) {
        activities.push({ type: "RECEIPT_GENERATED", title: "Reçu généré" });
      }
      if (i % 8 === 0) {
        activities.push({
          type: "EMAIL_SIMULATED",
          title: "Email reçu simulé",
          description: customer.email ?? "contact@dev.local",
        });
      }
    } else {
      activities.push({
        type: "CANCELLED",
        title: "Paiement annulé",
        description: "Erreur de saisie — annulation demo",
      });
    }

    if (i % 9 === 0) {
      activities.push({ type: "NOTE", title: "Note interne ajoutée" });
    }

    for (const act of activities) {
      await prisma.paymentActivity.create({
        data: {
          organizationId,
          paymentId: payment.id,
          userId,
          type: act.type,
          title: act.title,
          description: act.description ?? null,
        },
      });
      activityCount++;
    }
  }

  const partialPayments = await prisma.payment.findMany({
    where: {
      organizationId,
      status: { in: ["CONFIRMED", "PARTIALLY_ALLOCATED"] },
      unallocatedAmount: { gt: 0 },
    },
  });

  for (const payment of partialPayments) {
    const customerInvoices = invoicesByCustomer.get(payment.customerId) ?? [];
    let cursor = customerInvoiceCursor.get(payment.customerId) ?? 0;
    let remaining = moneyToNumber(payment.unallocatedAmount);
    let safety = 0;

    while (isPositive(remaining) && customerInvoices.length > 0 && safety < 20) {
      safety++;
      const invoiceId = customerInvoices[cursor % customerInvoices.length];
      cursor++;
      const fresh = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!fresh || isZero(fresh.amountDue)) continue;

      const existing = await prisma.paymentAllocation.findUnique({
        where: { paymentId_invoiceId: { paymentId: payment.id, invoiceId } },
      });
      const allocAmount = roundMoney(Math.min(remaining, moneyToNumber(fresh.amountDue)));
      if (isZero(allocAmount)) continue;

      if (existing) {
        await prisma.paymentAllocation.update({
          where: { id: existing.id },
          data: { amount: toDbDecimal(moneyAdd(existing.amount, allocAmount)) },
        });
      } else {
        await prisma.paymentAllocation.create({
          data: {
            organizationId,
            paymentId: payment.id,
            invoiceId,
            customerId: payment.customerId,
            amount: toDbDecimal(allocAmount),
          },
        });
      }
      allocationCount++;
      remaining = roundMoney(moneyToNumber(moneySub(remaining, allocAmount)));

      await prisma.paymentActivity.create({
        data: {
          organizationId,
          paymentId: payment.id,
          userId,
          type: "ALLOCATED",
          title: "Allocation complémentaire",
          description: `Facture ${fresh.invoiceNumber}`,
        },
      });
      activityCount++;
    }
    customerInvoiceCursor.set(payment.customerId, cursor);
  }

  for (const inv of invoices) {
    if (!["CANCELLED", "CREDITED", "DRAFT"].includes(inv.status)) {
      await recalculateInvoicePaymentStatus(inv.id, organizationId);
    }
  }
  for (const customer of customers) {
    await recalculateCustomerOutstandingAmount(customer.id, organizationId);
  }

  console.log(`  ✓ 55 payments, ${allocationCount} allocations, ${activityCount} activities`);
}
