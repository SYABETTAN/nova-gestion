import {
  CreditNoteStatus,
  DiscountType,
  InvoiceActivityType,
  InvoiceLineType,
  InvoicePaymentStatus,
  InvoiceStatus,
  InvoiceType,
  PrismaClient,
} from "@prisma/client";
import { calculateInvoiceTotals } from "../lib/invoice-calculations";
import { moneyAdd, moneyMul, moneyToNumber } from "../lib/money";
import {
  CREDIT_NOTE_LINE_MONEY_FIELDS,
  CREDIT_NOTE_MONEY_FIELDS,
  INVOICE_LINE_MONEY_FIELDS,
  INVOICE_TOTAL_FIELDS,
  mapMoneyFieldsToDb,
} from "../lib/money-db";
import { roundMoney } from "../lib/pricing";

const INVOICE_TITLES = [
  "Facture abonnement plateforme Pro",
  "Facture formation utilisateurs",
  "Facture migration de données",
  "Facture support premium",
  "Facture intervention technique",
  "Facture audit gestion commerciale",
  "Facture paramétrage initial",
  "Facture connecteur e-commerce",
  "Facture maintenance corrective",
  "Facture pack onboarding PME",
  "Facture licence utilisateurs",
  "Facture reporting financier",
  "Facture module relances",
  "Facture extension stockage",
  "Facture revue mensuelle",
];

const STATUS_DISTRIBUTION: InvoiceStatus[] = [
  ...Array(8).fill("DRAFT"),
  ...Array(10).fill("VALIDATED"),
  ...Array(9).fill("SENT"),
  ...Array(6).fill("OVERDUE"),
  ...Array(7).fill("PAID"),
  ...Array(3).fill("PARTIALLY_PAID"),
  "CANCELLED",
  "CREDITED",
] as InvoiceStatus[];

const TYPE_DISTRIBUTION: InvoiceType[] = [
  ...Array(35).fill("STANDARD"),
  ...Array(6).fill("DEPOSIT"),
  ...Array(4).fill("FINAL"),
] as InvoiceType[];

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function seedInvoices(prisma: PrismaClient, organizationId: string, userId: string) {
  console.log("  Seeding invoices...");

  await prisma.creditNoteLine.deleteMany({ where: { organizationId } });
  await prisma.creditNote.deleteMany({ where: { organizationId } });
  await prisma.invoiceActivity.deleteMany({ where: { organizationId } });
  await prisma.invoiceLine.deleteMany({ where: { organizationId } });
  await prisma.invoice.deleteMany({ where: { organizationId } });

  const customers = await prisma.customer.findMany({
    where: { organizationId, isArchived: false },
    include: { contacts: true, addresses: true },
  });
  const items = await prisma.item.findMany({
    where: { organizationId, isArchived: false, status: "ACTIVE" },
    include: { unit: true },
  });
  const acceptedQuotes = await prisma.quote.findMany({
    where: { organizationId, status: "ACCEPTED" },
    include: { lines: true },
    take: 5,
  });

  if (customers.length === 0 || items.length === 0) {
    console.warn("  ⚠ Skipping invoices seed");
    return;
  }

  const users = await prisma.user.findMany();
  const salesUser = users.find((u) => u.email === "sales@dev.local") ?? users[0];
  let lineCount = 0;
  let activityCount = 0;
  const createdInvoices: { id: string; status: InvoiceStatus; totalIncludingTax: number }[] = [];

  for (let i = 0; i < 45; i++) {
    const customer = customers[i % customers.length];
    const contact = customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0];
    const billing = customer.addresses.find((a) => a.type === "BILLING") ?? customer.addresses[0];
    const shipping = customer.addresses.find((a) => a.type === "SHIPPING") ?? billing;
    const status = STATUS_DISTRIBUTION[i];
    const type = TYPE_DISTRIBUTION[i];
    const issueDate = daysAgo(120 - i * 2);
    const paymentTerms = customer.defaultPaymentTermsDays ?? 30;
    const dueDate = addDays(issueDate, paymentTerms);
    const invoiceNumber = `FAC-2026-${String(i + 1).padStart(4, "0")}`;
    const title = INVOICE_TITLES[i % INVOICE_TITLES.length];
    const linkedQuote = i < acceptedQuotes.length ? acceptedQuotes[i] : null;

    const numLines = 1 + (i % 6);
    const lineInputs: {
      lineType: InvoiceLineType;
      quantity: number;
      unitPriceExcludingTax: number;
      discountType: DiscountType | null;
      discountValue: number;
      vatRate: number;
      itemId: string | null;
      quoteLineId: string | null;
      reference: string | null;
      name: string;
      description: string | null;
      unit: string;
      position: number;
    }[] = [];

    for (let j = 0; j < numLines; j++) {
      const item = items[(i + j) % items.length];
      const hasDiscount = (i + j) % 5 === 0;
      lineInputs.push({
        lineType: item.type === "SERVICE" ? "SERVICE" : "ITEM",
        quantity: 1 + (j % 2),
        unitPriceExcludingTax: moneyToNumber(item.salePriceExcludingTax),
        discountType: hasDiscount ? "PERCENTAGE" : null,
        discountValue: hasDiscount ? 5 : 0,
        vatRate: moneyToNumber(item.defaultVatRate),
        itemId: item.id,
        quoteLineId: null,
        reference: item.itemNumber,
        name: item.name,
        description: item.shortDescription,
        unit: item.unit?.symbol ?? "unité",
        position: j,
      });
    }

    const globalDiscountType: DiscountType | null = i % 8 === 0 ? "PERCENTAGE" : null;
    const globalDiscountValue = globalDiscountType ? 2 : 0;
    const shippingAmount = i % 7 === 0 ? 20 : 0;
    const otherFees = i % 9 === 0 ? 10 : 0;

    let amountPaid = 0;
    let paymentStatus: InvoicePaymentStatus = "UNPAID";
    if (status === "PAID") {
      paymentStatus = "PAID";
    } else if (status === "PARTIALLY_PAID") {
      paymentStatus = "PARTIALLY_PAID";
    } else if (status === "OVERDUE") {
      paymentStatus = "OVERDUE";
    }

    const totals = calculateInvoiceTotals({
      lines: lineInputs,
      globalDiscountType,
      globalDiscountValue,
      shippingAmountExcludingTax: shippingAmount,
      otherFeesExcludingTax: otherFees,
      amountPaid: 0,
    });

    if (status === "PAID") amountPaid = totals.totalIncludingTax;
    else if (status === "PARTIALLY_PAID") amountPaid = roundMoney(totals.totalIncludingTax * 0.4);

    const finalTotals = calculateInvoiceTotals({
      lines: lineInputs,
      globalDiscountType,
      globalDiscountValue,
      shippingAmountExcludingTax: shippingAmount,
      otherFeesExcludingTax: otherFees,
      amountPaid,
    });

    const validatedAt = ["VALIDATED", "SENT", "OVERDUE", "PAID", "PARTIALLY_PAID", "CREDITED"].includes(status)
      ? addDays(issueDate, 1)
      : null;
    const sentAt = ["SENT", "OVERDUE", "PAID", "PARTIALLY_PAID"].includes(status) ? addDays(issueDate, 2) : null;
    const paidAt = status === "PAID" ? addDays(sentAt ?? issueDate, 10) : null;
    const cancelledAt = status === "CANCELLED" ? addDays(issueDate, 3) : null;
    const creditedAt = status === "CREDITED" ? addDays(issueDate, 15) : null;

    const invoiceTotals = mapMoneyFieldsToDb(
      {
        subtotalExcludingTax: finalTotals.subtotalExcludingTax,
        totalDiscountAmount: finalTotals.totalDiscountAmount,
        totalExcludingTax: finalTotals.totalExcludingTax,
        totalVatAmount: finalTotals.totalVatAmount,
        totalIncludingTax: finalTotals.totalIncludingTax,
        amountPaid: finalTotals.amountPaid,
        amountDue: finalTotals.amountDue,
        globalDiscountValue,
        shippingAmountExcludingTax: shippingAmount,
        otherFeesExcludingTax: otherFees,
      },
      [...INVOICE_TOTAL_FIELDS],
    );

    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        customerId: customer.id,
        customerContactId: contact?.id ?? null,
        billingAddressId: billing?.id ?? null,
        shippingAddressId: shipping?.id ?? null,
        quoteId: linkedQuote?.id ?? null,
        type,
        status,
        paymentStatus,
        title,
        subject: `Facturation — ${customer.name}`,
        issueDate,
        dueDate,
        validatedAt,
        sentAt,
        paidAt,
        cancelledAt,
        creditedAt,
        currency: "EUR",
        language: "fr-FR",
        paymentTermsDays: paymentTerms,
        introductionText: "Merci pour votre confiance. Veuillez trouver ci-dessous notre facture.",
        footerText: "Paiement par virement — IBAN fictif",
        internalNotes: i % 4 === 0 ? "Relance prévue si impayé J+15" : null,
        ...invoiceTotals,
        globalDiscountType,
        createdById: i % 2 === 0 ? salesUser.id : userId,
        updatedById: userId,
        createdAt: issueDate,
        lines: {
          create: finalTotals.lines.map((line, idx) =>
            mapMoneyFieldsToDb(
              {
                organizationId,
                itemId: lineInputs[idx].itemId,
                quoteLineId: lineInputs[idx].quoteLineId,
                lineType: line.lineType as InvoiceLineType,
                position: lineInputs[idx].position,
                reference: lineInputs[idx].reference,
                name: lineInputs[idx].name,
                description: lineInputs[idx].description,
                quantity: line.quantity,
                unit: lineInputs[idx].unit,
                unitPriceExcludingTax: line.unitPriceExcludingTax,
                discountType: line.discountType as DiscountType | null,
                discountValue: line.discountValue,
                discountAmount: line.discountAmount,
                vatRate: line.vatRate,
                totalExcludingTax: line.totalExcludingTax,
                totalVatAmount: line.totalVatAmount,
                totalIncludingTax: line.totalIncludingTax,
              },
              [...INVOICE_LINE_MONEY_FIELDS],
            ),
          ),
        },
      },
    });

    lineCount += finalTotals.lines.length;
    createdInvoices.push({ id: invoice.id, status, totalIncludingTax: finalTotals.totalIncludingTax });

    const activities: { type: InvoiceActivityType; title: string }[] = [
      { type: "CREATED", title: "Facture créée" },
      ...(linkedQuote ? [{ type: "CREATED_FROM_QUOTE" as InvoiceActivityType, title: "Créée depuis devis" }] : []),
      ...(validatedAt ? [{ type: "VALIDATED" as InvoiceActivityType, title: "Facture validée" }] : []),
      ...(sentAt ? [{ type: "SENT" as InvoiceActivityType, title: "Facture envoyée" }] : []),
      ...(status === "PAID" ? [{ type: "MARKED_PAID_PLACEHOLDER" as InvoiceActivityType, title: "Paiement simulé" }] : []),
    ];

    for (let a = 0; a < activities.length; a++) {
      await prisma.invoiceActivity.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          userId: salesUser.id,
          type: activities[a].type,
          title: activities[a].title,
          createdAt: addDays(issueDate, a),
        },
      });
      activityCount++;
    }

    if (linkedQuote) {
      await prisma.quote.update({
        where: { id: linkedQuote.id },
        data: { status: "CONVERTED", convertedToInvoiceAt: issueDate },
      });
    }
  }

  // Credit notes for 8 invoices (including CREDITED status)
  const creditTargets = createdInvoices.filter((inv) =>
    ["VALIDATED", "SENT", "PAID", "CREDITED"].includes(inv.status),
  ).slice(0, 8);

  let cnLineCount = 0;
  for (let c = 0; c < creditTargets.length; c++) {
    const inv = await prisma.invoice.findUnique({
      where: { id: creditTargets[c].id },
      include: { lines: true, customer: true },
    });
    if (!inv) continue;

    const creditNoteNumber = `AVO-2026-${String(c + 1).padStart(4, "0")}`;
    const isTotal = c % 2 === 0 || inv.status === "CREDITED";

    let totalExcludingTax = 0;
    let totalVatAmount = 0;
    let totalIncludingTax = 0;
    const cnLines = isTotal
      ? inv.lines
          .filter((l) => l.lineType !== "SECTION" && l.lineType !== "COMMENT")
          .map((l, pos) => {
            totalExcludingTax = moneyToNumber(moneyAdd(totalExcludingTax, l.totalExcludingTax));
            totalVatAmount = moneyToNumber(moneyAdd(totalVatAmount, l.totalVatAmount));
            totalIncludingTax = moneyToNumber(moneyAdd(totalIncludingTax, l.totalIncludingTax));
            return mapMoneyFieldsToDb(
              {
                organizationId,
                invoiceLineId: l.id,
                position: pos,
                name: l.name,
                description: l.description,
                quantity: l.quantity,
                unitPriceExcludingTax: l.unitPriceExcludingTax,
                vatRate: l.vatRate,
                totalExcludingTax: l.totalExcludingTax,
                totalVatAmount: l.totalVatAmount,
                totalIncludingTax: l.totalIncludingTax,
              },
              [...CREDIT_NOTE_LINE_MONEY_FIELDS],
            );
          })
      : (() => {
          const partial = roundMoney(moneyMul(inv.totalIncludingTax, 0.25));
          const ht = roundMoney(partial / 1.2);
          const vat = roundMoney(partial - ht);
          totalExcludingTax = ht;
          totalVatAmount = vat;
          totalIncludingTax = partial;
          return [
            mapMoneyFieldsToDb(
              {
                organizationId,
                invoiceLineId: null,
                position: 0,
                name: "Avoir partiel",
                description: "Correction commerciale",
                quantity: 1,
                unitPriceExcludingTax: ht,
                vatRate: 20,
                totalExcludingTax: ht,
                totalVatAmount: vat,
                totalIncludingTax: partial,
              },
              [...CREDIT_NOTE_LINE_MONEY_FIELDS],
            ),
          ];
        })();

    cnLineCount += cnLines.length;

    const creditNoteTotals = mapMoneyFieldsToDb(
      { totalExcludingTax, totalVatAmount, totalIncludingTax },
      [...CREDIT_NOTE_MONEY_FIELDS],
    );

    await prisma.creditNote.create({
      data: {
        organizationId,
        creditNoteNumber,
        invoiceId: inv.id,
        customerId: inv.customerId,
        status: "VALIDATED" as CreditNoteStatus,
        issueDate: addDays(inv.issueDate, 20),
        reason: isTotal ? "Annulation totale — erreur de facturation" : "Avoir partiel — geste commercial",
        ...creditNoteTotals,
        createdById: userId,
        lines: { create: cnLines },
      },
    });

    if (isTotal && inv.status !== "CREDITED") {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: "CREDITED", creditedAt: new Date() },
      });
    }
  }

  await prisma.numberingSequence.updateMany({
    where: { organizationId, type: "INVOICE" },
    data: { nextNumber: 46 },
  });
  await prisma.numberingSequence.updateMany({
    where: { organizationId, type: "CREDIT_NOTE" },
    data: { nextNumber: 9 },
  });

  console.log(`  ✓ ${45} invoices, ${lineCount} lines, ${activityCount} activities, ${creditTargets.length} credit notes, ${cnLineCount} CN lines`);
}
