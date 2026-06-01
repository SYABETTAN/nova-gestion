import {
  DiscountType,
  PrismaClient,
  QuoteActivityType,
  QuoteLineType,
  QuoteStatus,
} from "@prisma/client";
import { calculateQuoteTotals } from "../lib/quote-calculations";
import { moneyToNumber } from "../lib/money";
import { mapMoneyFieldsToDb, QUOTE_LINE_MONEY_FIELDS } from "../lib/money-db";

const QUOTE_TITLES = [
  "Mise en place solution de gestion commerciale",
  "Pack onboarding PME",
  "Formation utilisateurs initiale",
  "Migration de données clients",
  "Abonnement annuel plateforme Pro",
  "Support premium trimestriel",
  "Audit process facturation",
  "Paramétrage modèles PDF",
  "Connecteur e-commerce",
  "Accompagnement reporting financier",
  "Pack automatisation devis",
  "Module relances clients",
  "Intervention technique sur site",
  "Formation administrateur",
  "Extension stockage documents",
  "Revue mensuelle de gestion",
  "Paramétrage TVA et exports",
  "Pack tableaux de bord",
  "Licence utilisateurs avancés",
  "Maintenance corrective",
];

const STATUS_DISTRIBUTION: QuoteStatus[] = [
  ...Array(8).fill("DRAFT"),
  ...Array(9).fill("SENT"),
  ...Array(3).fill("VIEWED"),
  ...Array(7).fill("ACCEPTED"),
  ...Array(4).fill("REFUSED"),
  ...Array(2).fill("EXPIRED"),
  "CANCELLED",
  "CONVERTED",
] as QuoteStatus[];

const ACTIVITY_TEMPLATES: { type: QuoteActivityType; title: string }[] = [
  { type: "CREATED", title: "Devis créé" },
  { type: "UPDATED", title: "Devis modifié" },
  { type: "SENT", title: "Devis envoyé par email simulé" },
  { type: "VIEWED", title: "Devis consulté par le client" },
  { type: "ACCEPTED", title: "Devis accepté" },
  { type: "REFUSED", title: "Devis refusé" },
  { type: "PDF_GENERATED", title: "PDF généré" },
  { type: "EMAIL_SIMULATED", title: "Email simulé envoyé" },
  { type: "NOTE", title: "Note interne ajoutée" },
  { type: "DUPLICATED", title: "Devis dupliqué" },
  { type: "CONVERTED", title: "Conversion simulée en facture" },
];

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

export async function seedQuotes(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
) {
  console.log("  Seeding quotes...");

  await prisma.quoteActivity.deleteMany({ where: { organizationId } });
  await prisma.quoteLine.deleteMany({ where: { organizationId } });
  await prisma.quote.deleteMany({ where: { organizationId } });

  const customers = await prisma.customer.findMany({
    where: { organizationId, isArchived: false },
    include: { contacts: true, addresses: true },
  });

  const items = await prisma.item.findMany({
    where: { organizationId, isArchived: false, status: "ACTIVE" },
    include: { unit: true },
  });

  if (customers.length === 0 || items.length === 0) {
    console.warn("  ⚠ Skipping quotes seed — customers or items missing");
    return;
  }

  const users = await prisma.user.findMany();
  const salesUser = users.find((u) => u.email === "sales@dev.local") ?? users[0];

  let lineCount = 0;
  let activityCount = 0;

  for (let i = 0; i < 35; i++) {
    const customer = customers[i % customers.length];
    const contact = customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0];
    const billing = customer.addresses.find((a) => a.type === "BILLING") ?? customer.addresses[0];
    const shipping = customer.addresses.find((a) => a.type === "SHIPPING") ?? billing;

    const status = STATUS_DISTRIBUTION[i];
    const issueDate = daysAgo(90 - i * 2);
    const validUntil = addDays(issueDate, 30);
    const quoteNumber = `DEV-2026-${String(i + 1).padStart(4, "0")}`;
    const title = QUOTE_TITLES[i % QUOTE_TITLES.length];

    const numLines = 1 + (i % 6);
    const lineInputs: {
      lineType: QuoteLineType;
      quantity: number;
      unitPriceExcludingTax: number;
      discountType: DiscountType | null;
      discountValue: number;
      vatRate: number;
      itemId: string | null;
      reference: string | null;
      name: string;
      description: string | null;
      unit: string;
      position: number;
    }[] = [];

    for (let j = 0; j < numLines; j++) {
      const item = items[(i + j) % items.length];
      const hasDiscount = (i + j) % 4 === 0;
      const isSection = j === numLines - 1 && i % 5 === 0;

      if (isSection) {
        lineInputs.push({
          lineType: "SECTION",
          quantity: 1,
          unitPriceExcludingTax: 0,
          discountType: null,
          discountValue: 0,
          vatRate: 20,
          itemId: null,
          reference: null,
          name: "Détail des prestations",
          description: null,
          unit: "—",
          position: j,
        });
        continue;
      }

      lineInputs.push({
        lineType: item.type === "SERVICE" ? "SERVICE" : "ITEM",
        quantity: 1 + (j % 3),
        unitPriceExcludingTax: moneyToNumber(item.salePriceExcludingTax),
        discountType: hasDiscount ? "PERCENTAGE" : null,
        discountValue: hasDiscount ? 5 + (j % 3) * 5 : 0,
        vatRate: moneyToNumber(item.defaultVatRate),
        itemId: item.id,
        reference: item.itemNumber,
        name: item.name,
        description: item.shortDescription ?? item.description,
        unit: item.unit?.symbol ?? "unité",
        position: j,
      });
    }

    const globalDiscountType: DiscountType | null = i % 7 === 0 ? "PERCENTAGE" : null;
    const globalDiscountValue = globalDiscountType ? 3 : 0;
    const shippingAmount = i % 6 === 0 ? 25 : 0;
    const otherFees = i % 8 === 0 ? 15 : 0;

    const totals = calculateQuoteTotals({
      lines: lineInputs.map((l) => ({
        lineType: l.lineType,
        quantity: l.quantity,
        unitPriceExcludingTax: l.unitPriceExcludingTax,
        discountType: l.discountType,
        discountValue: l.discountValue,
        vatRate: l.vatRate,
      })),
      globalDiscountType,
      globalDiscountValue,
      shippingAmountExcludingTax: shippingAmount,
      otherFeesExcludingTax: otherFees,
    });

    const sentAt =
      status !== "DRAFT" ? addDays(issueDate, 1 + (i % 3)) : null;
    const acceptedAt = status === "ACCEPTED" || status === "CONVERTED"
      ? addDays(sentAt ?? issueDate, 5)
      : null;
    const refusedAt = status === "REFUSED" ? addDays(sentAt ?? issueDate, 4) : null;
    const expiredAt = status === "EXPIRED" ? addDays(validUntil, 1) : null;
    const convertedToInvoiceAt = status === "CONVERTED" ? addDays(acceptedAt!, 2) : null;

    const quoteTotals = mapMoneyFieldsToDb(
      {
        subtotalExcludingTax: totals.subtotalExcludingTax,
        totalDiscountAmount: totals.totalDiscountAmount,
        totalExcludingTax: totals.totalExcludingTax,
        totalVatAmount: totals.totalVatAmount,
        totalIncludingTax: totals.totalIncludingTax,
        globalDiscountValue,
        shippingAmountExcludingTax: shippingAmount,
        otherFeesExcludingTax: otherFees,
      },
      [
        "subtotalExcludingTax",
        "totalDiscountAmount",
        "totalExcludingTax",
        "totalVatAmount",
        "totalIncludingTax",
        "globalDiscountValue",
        "shippingAmountExcludingTax",
        "otherFeesExcludingTax",
      ],
    );

    const quote = await prisma.quote.create({
      data: {
        organizationId,
        quoteNumber,
        customerId: customer.id,
        customerContactId: contact?.id ?? null,
        billingAddressId: billing?.id ?? null,
        shippingAddressId: shipping?.id ?? null,
        status,
        title,
        subject: `Proposition commerciale — ${customer.name}`,
        issueDate,
        validUntil,
        sentAt,
        acceptedAt,
        refusedAt,
        expiredAt,
        convertedToInvoiceAt,
        currency: "EUR",
        language: "fr-FR",
        paymentTermsDays: customer.defaultPaymentTermsDays ?? 30,
        introductionText:
          "Merci pour votre confiance. Veuillez trouver ci-dessous notre proposition commerciale.",
        footerText: "Devis valable 30 jours — Conditions générales sur demande.",
        internalNotes: i % 3 === 0 ? "Client à relancer si pas de réponse sous 15 jours." : null,
        customerNotes: i % 4 === 0 ? "Merci de valider ce devis par retour email." : null,
        ...quoteTotals,
        globalDiscountType,
        createdById: i % 2 === 0 ? salesUser.id : userId,
        updatedById: userId,
        createdAt: issueDate,
        lines: {
          create: totals.lines.map((line, idx) =>
            mapMoneyFieldsToDb(
              {
                organizationId,
                itemId: lineInputs[idx].itemId,
                lineType: line.lineType,
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
              [...QUOTE_LINE_MONEY_FIELDS],
            ),
          ),
        },
      },
    });

    lineCount += totals.lines.length;

    const numActivities = 2 + (i % 4);
    for (let a = 0; a < numActivities; a++) {
      const template = ACTIVITY_TEMPLATES[(i + a) % ACTIVITY_TEMPLATES.length];
      const activityDate = addDays(issueDate, a + 1);
      await prisma.quoteActivity.create({
        data: {
          organizationId,
          quoteId: quote.id,
          userId: a % 2 === 0 ? salesUser.id : userId,
          type: template.type,
          title: template.title,
          description: `${template.title} — ${quoteNumber}`,
          createdAt: activityDate,
        },
      });
      activityCount++;
    }
  }

  // Update numbering sequence next number
  await prisma.numberingSequence.updateMany({
    where: { organizationId, type: "QUOTE" },
    data: { nextNumber: 36 },
  });

  console.log(`  ✓ ${35} quotes, ${lineCount} lines, ${activityCount} activities`);
}
