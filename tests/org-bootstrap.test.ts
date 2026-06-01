import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { moneyToNumber, toDbDecimal } from "@/lib/money";
import { bootstrapOrganization } from "@/lib/org-bootstrap";
import {
  BOOTSTRAP_ACCOUNTING_MAPPINGS,
  BOOTSTRAP_JOURNALS,
  BOOTSTRAP_NUMBERING_SEQUENCES,
  BOOTSTRAP_TAX_RATES,
} from "@/lib/org-bootstrap-defaults";
import { getPermissionsForRole, hasPermission } from "@/lib/permissions";
import { generateNextNumber } from "@/lib/numbering";
import { getSettingsCompletionStatus } from "@/lib/settings";
import {
  buildCustomerInvoiceEntry,
  buildCustomerPaymentEntry,
  entryDataToCreatePayload,
  loadAccountMap,
} from "@/lib/accounting-generators";
import { getJournalByCodeQuery } from "@/lib/accounting";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";

const prisma = new PrismaClient();
const testOrgSlugs: string[] = [];

async function createFreshOrganization(suffix: string) {
  const slug = `test-bootstrap-${suffix}-${Date.now()}`;
  testOrgSlugs.push(slug);

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER" } });
  const passwordHash = await bcrypt.hash("TestBootstrap123!", 10);
  const email = `bootstrap-${suffix}-${Date.now()}@test.local`;

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: `Org Test ${suffix}`,
        legalName: `Org Test ${suffix}`,
        slug,
        email,
        country: "FR",
      },
    });

    const user = await tx.user.create({
      data: {
        name: "Owner Test",
        email,
        passwordHash,
        memberships: {
          create: {
            organizationId: organization.id,
            roleId: ownerRole.id,
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        },
      },
    });

    await bootstrapOrganization(tx, organization.id);

    return { organization, user };
  });
}

describe("org bootstrap — inscription production", () => {
  beforeAll(async () => {
    const ownerRole = await prisma.role.findUnique({ where: { key: "OWNER" } });
    if (!ownerRole) {
      throw new Error("Rôles non seedés — exécutez npm run db:seed");
    }
  });

  afterEach(async () => {
    for (const slug of testOrgSlugs.splice(0)) {
      const org = await prisma.organization.findUnique({ where: { slug } });
      if (org) {
        await prisma.organization.delete({ where: { id: org.id } });
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("crée une organisation avec bootstrap complet", async () => {
    const { organization, user } = await createFreshOrganization("full");

    expect(organization.id).toBeTruthy();
    expect(user.email).toContain("@test.local");

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: organization.id, userId: user.id },
      include: { role: true },
    });
    expect(membership?.role.key).toBe("OWNER");

    const permissions = getPermissionsForRole("OWNER");
    expect(hasPermission({ permissions }, "CUSTOMERS_CREATE")).toBe(true);
    expect(hasPermission({ permissions }, "INVOICES_CREATE")).toBe(true);
    expect(hasPermission({ permissions }, "ACCOUNTING_CREATE")).toBe(true);
  });

  it("crée les paramètres obligatoires", async () => {
    const { organization } = await createFreshOrganization("settings");
    const orgId = organization.id;

    const completion = await getSettingsCompletionStatus(orgId);
    expect(completion.hasDefaultTaxRate).toBe(true);
    expect(completion.hasDefaultPaymentTerm).toBe(true);
    expect(completion.hasAccountingMappings).toBe(true);
    expect(completion.hasDocumentTemplates).toBe(true);
    expect(completion.isComplete).toBe(true);

    const [taxCount, termCount, currencyCount, flagsCount] = await Promise.all([
      prisma.taxRate.count({ where: { organizationId: orgId } }),
      prisma.paymentTerm.count({ where: { organizationId: orgId } }),
      prisma.currencySetting.count({ where: { organizationId: orgId } }),
      prisma.featureFlag.count({ where: { organizationId: orgId } }),
    ]);

    expect(taxCount).toBe(BOOTSTRAP_TAX_RATES.length);
    expect(termCount).toBeGreaterThanOrEqual(5);
    expect(currencyCount).toBeGreaterThanOrEqual(1);
    expect(flagsCount).toBeGreaterThanOrEqual(10);
  });

  it("crée les séquences de numérotation", async () => {
    const { organization, user } = await createFreshOrganization("numbering");
    const sequences = await prisma.numberingSequence.findMany({
      where: { organizationId: organization.id },
    });
    expect(sequences).toHaveLength(BOOTSTRAP_NUMBERING_SEQUENCES.length);

    const customerNumber = await generateNextNumber(organization.id, "CUSTOMER", user.id);
    expect(customerNumber).toMatch(/^CLI-\d{4}$/);
  });

  it("crée les journaux comptables et mappings essentiels", async () => {
    const { organization } = await createFreshOrganization("accounting");
    const orgId = organization.id;

    const journals = await prisma.accountingJournal.findMany({ where: { organizationId: orgId } });
    expect(journals).toHaveLength(BOOTSTRAP_JOURNALS.length);

    const mappings = await prisma.accountingMapping.findMany({ where: { organizationId: orgId } });
    expect(mappings.length).toBe(BOOTSTRAP_ACCOUNTING_MAPPINGS.length);
  });

  it("est idempotent lors d'un second appel bootstrap", async () => {
    const { organization } = await createFreshOrganization("idempotent");

    await prisma.$transaction(async (tx) => {
      await bootstrapOrganization(tx, organization.id);
    });

    const sequences = await prisma.numberingSequence.findMany({
      where: { organizationId: organization.id },
    });
    expect(sequences).toHaveLength(BOOTSTRAP_NUMBERING_SEQUENCES.length);
  });

  it("permet de créer un client sans seed de démo", async () => {
    const { organization, user } = await createFreshOrganization("customer");
    const customerNumber = await generateNextNumber(organization.id, "CUSTOMER", user.id);

    const customer = await prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerNumber,
        type: "COMPANY",
        status: "ACTIVE",
        name: "Client Réel SA",
        defaultPaymentTermsDays: 30,
        defaultVatRate: 20,
        currency: "EUR",
      },
    });

    expect(customer.customerNumber).toBe(customerNumber);
  });

  it("permet de créer un article/service sans seed de démo", async () => {
    const { organization, user } = await createFreshOrganization("item");
    const itemNumber = await generateNextNumber(organization.id, "ITEM", user.id);

    const item = await prisma.item.create({
      data: {
        organizationId: organization.id,
        itemNumber,
        type: "SERVICE",
        status: "ACTIVE",
        name: "Prestation conseil",
        defaultVatRate: 20,
        salePriceExcludingTax: 500,
        salePriceIncludingTax: 600,
        currency: "EUR",
      },
    });

    expect(item.itemNumber).toBe(itemNumber);
  });

  it("permet de créer un devis sans seed de démo", async () => {
    const { organization, user } = await createFreshOrganization("quote");
    const customerNumber = await generateNextNumber(organization.id, "CUSTOMER", user.id);
    const customer = await prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerNumber,
        type: "COMPANY",
        status: "ACTIVE",
        name: "Client Devis",
        defaultPaymentTermsDays: 30,
        defaultVatRate: 20,
        currency: "EUR",
      },
    });

    const quoteNumber = await generateNextNumber(organization.id, "QUOTE", user.id);
    const quote = await prisma.quote.create({
      data: {
        organizationId: organization.id,
        quoteNumber,
        customerId: customer.id,
        status: "DRAFT",
        title: "Devis initial",
        issueDate: new Date(),
        validUntil: new Date(Date.now() + 30 * 86400000),
        currency: "EUR",
        language: "fr",
        paymentTermsDays: 30,
        subtotalExcludingTax: 1000,
        totalDiscountAmount: 0,
        totalExcludingTax: 1000,
        totalVatAmount: 200,
        totalIncludingTax: 1200,
        createdById: user.id,
        updatedById: user.id,
        lines: {
          create: [
            {
              organizationId: organization.id,
              lineType: "SERVICE",
              position: 0,
              name: "Prestation",
              quantity: 1,
              unit: "forfait",
              unitPriceExcludingTax: 1000,
              vatRate: 20,
              totalExcludingTax: 1000,
              totalVatAmount: 200,
              totalIncludingTax: 1200,
            },
          ],
        },
      },
    });

    expect(quote.quoteNumber).toBe(quoteNumber);
  });

  it("permet de convertir un devis accepté en facture", async () => {
    const { organization, user } = await createFreshOrganization("convert");
    const customer = await prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerNumber: await generateNextNumber(organization.id, "CUSTOMER", user.id),
        type: "COMPANY",
        status: "ACTIVE",
        name: "Client Conversion",
        defaultPaymentTermsDays: 30,
        defaultVatRate: 20,
        currency: "EUR",
      },
    });

    const quote = await prisma.quote.create({
      data: {
        organizationId: organization.id,
        quoteNumber: await generateNextNumber(organization.id, "QUOTE", user.id),
        customerId: customer.id,
        status: "ACCEPTED",
        title: "Devis accepté",
        issueDate: new Date(),
        validUntil: new Date(Date.now() + 30 * 86400000),
        currency: "EUR",
        language: "fr",
        paymentTermsDays: 30,
        subtotalExcludingTax: 500,
        totalDiscountAmount: 0,
        totalExcludingTax: 500,
        totalVatAmount: 100,
        totalIncludingTax: 600,
        createdById: user.id,
        updatedById: user.id,
        lines: {
          create: [
            {
              organizationId: organization.id,
              lineType: "SERVICE",
              position: 0,
              name: "Service",
              quantity: 1,
              unit: "forfait",
              unitPriceExcludingTax: 500,
              vatRate: 20,
              totalExcludingTax: 500,
              totalVatAmount: 100,
              totalIncludingTax: 600,
            },
          ],
        },
      },
      include: { lines: true },
    });

    const invoiceNumber = await generateNextNumber(organization.id, "INVOICE", user.id);
    const dueDate = new Date(quote.issueDate);
    dueDate.setDate(dueDate.getDate() + quote.paymentTermsDays);

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: organization.id,
        invoiceNumber,
        customerId: customer.id,
        quoteId: quote.id,
        type: "STANDARD",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        title: quote.title,
        issueDate: new Date(),
        dueDate,
        currency: "EUR",
        language: "fr",
        paymentTermsDays: 30,
        subtotalExcludingTax: quote.totalExcludingTax,
        totalDiscountAmount: 0,
        totalExcludingTax: quote.totalExcludingTax,
        totalVatAmount: quote.totalVatAmount,
        totalIncludingTax: quote.totalIncludingTax,
        amountPaid: 0,
        amountDue: quote.totalIncludingTax,
        createdById: user.id,
        updatedById: user.id,
        lines: {
          create: quote.lines.map((line) => ({
            organizationId: organization.id,
            lineType: line.lineType,
            position: line.position,
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            unitPriceExcludingTax: line.unitPriceExcludingTax,
            vatRate: line.vatRate,
            totalExcludingTax: line.totalExcludingTax,
            totalVatAmount: line.totalVatAmount,
            totalIncludingTax: line.totalIncludingTax,
          })),
        },
      },
    });

    expect(invoice.invoiceNumber).toMatch(/^FAC-\d{4}-\d{4}$/);
    expect(invoice.quoteId).toBe(quote.id);
  });

  it("permet de créer une facture directement", async () => {
    const { organization, user } = await createFreshOrganization("invoice");
    const customer = await prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerNumber: await generateNextNumber(organization.id, "CUSTOMER", user.id),
        type: "COMPANY",
        status: "ACTIVE",
        name: "Client Facture",
        defaultPaymentTermsDays: 30,
        defaultVatRate: 20,
        currency: "EUR",
      },
    });

    const totals = calculateInvoiceTotals({
      lines: [
        {
          lineType: "SERVICE",
          quantity: 2,
          unitPriceExcludingTax: 150,
          discountValue: 0,
          vatRate: 20,
        },
      ],
      globalDiscountValue: 0,
      shippingAmountExcludingTax: 0,
      otherFeesExcludingTax: 0,
    });

    const invoiceNumber = await generateNextNumber(organization.id, "INVOICE", user.id);
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: organization.id,
        invoiceNumber,
        customerId: customer.id,
        type: "STANDARD",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        title: "Facture directe",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        currency: "EUR",
        language: "fr",
        paymentTermsDays: 30,
        subtotalExcludingTax: totals.subtotalExcludingTax,
        totalDiscountAmount: totals.totalDiscountAmount,
        totalExcludingTax: totals.totalExcludingTax,
        totalVatAmount: totals.totalVatAmount,
        totalIncludingTax: totals.totalIncludingTax,
        amountPaid: 0,
        amountDue: totals.totalIncludingTax,
        createdById: user.id,
        updatedById: user.id,
        lines: {
          create: totals.lines.map((line, index) => ({
            organizationId: organization.id,
            lineType: "SERVICE",
            position: index,
            name: "Consulting",
            quantity: toDbDecimal(line.quantity),
            unit: "heure",
            unitPriceExcludingTax: toDbDecimal(line.unitPriceExcludingTax),
            vatRate: toDbDecimal(line.vatRate),
            totalExcludingTax: toDbDecimal(line.totalExcludingTax),
            totalVatAmount: toDbDecimal(line.totalVatAmount),
            totalIncludingTax: toDbDecimal(line.totalIncludingTax),
          })),
        },
      },
    });

    expect(moneyToNumber(invoice.totalIncludingTax)).toBeGreaterThan(0);
  });

  it("permet d'enregistrer un paiement et de générer une écriture comptable", async () => {
    const { organization, user } = await createFreshOrganization("payment");
    const customer = await prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerNumber: await generateNextNumber(organization.id, "CUSTOMER", user.id),
        type: "COMPANY",
        status: "ACTIVE",
        name: "Client Paiement",
        defaultPaymentTermsDays: 30,
        defaultVatRate: 20,
        currency: "EUR",
      },
    });

    const invoiceNumber = await generateNextNumber(organization.id, "INVOICE", user.id);
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: organization.id,
        invoiceNumber,
        customerId: customer.id,
        type: "STANDARD",
        status: "SENT",
        paymentStatus: "UNPAID",
        title: "Facture à payer",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        currency: "EUR",
        language: "fr",
        paymentTermsDays: 30,
        subtotalExcludingTax: 1000,
        totalDiscountAmount: 0,
        totalExcludingTax: 1000,
        totalVatAmount: 200,
        totalIncludingTax: 1200,
        amountPaid: 0,
        amountDue: 1200,
        createdById: user.id,
        updatedById: user.id,
        lines: {
          create: [
            {
              organizationId: organization.id,
              lineType: "SERVICE",
              position: 0,
              name: "Prestation",
              quantity: 1,
              unit: "forfait",
              unitPriceExcludingTax: 1000,
              vatRate: 20,
              totalExcludingTax: 1000,
              totalVatAmount: 200,
              totalIncludingTax: 1200,
            },
          ],
        },
      },
    });

    const paymentNumber = await generateNextNumber(organization.id, "PAYMENT", user.id);
    const payment = await prisma.payment.create({
      data: {
        organizationId: organization.id,
        paymentNumber,
        customerId: customer.id,
        amount: 1200,
        currency: "EUR",
        method: "BANK_TRANSFER",
        status: "CONFIRMED",
        paymentDate: new Date(),
        receivedById: user.id,
      },
    });

    expect(payment.paymentNumber).toMatch(/^REG-\d{4}-\d{4}$/);

    const accountMap = await loadAccountMap(prisma, organization.id);
    const journal = await getJournalByCodeQuery(organization.id, "VE");
    expect(journal).toBeTruthy();

    const invoiceEntry = buildCustomerInvoiceEntry(accountMap, {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      totalExcludingTax: invoice.totalExcludingTax,
      totalVatAmount: invoice.totalVatAmount,
      totalIncludingTax: invoice.totalIncludingTax,
      customer: { id: customer.id, name: customer.name },
      lines: [{ lineType: "SERVICE", itemId: null }],
    });
    const invoicePayload = entryDataToCreatePayload(invoiceEntry, journal!.id, organization.id);
    expect(invoicePayload.payload.isBalanced).toBe(true);

    const paymentEntry = buildCustomerPaymentEntry(accountMap, {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentDate: payment.paymentDate,
      amount: payment.amount,
      method: "BANK_TRANSFER",
      customer: { id: customer.id, name: customer.name },
    });
    const paymentPayload = entryDataToCreatePayload(
      paymentEntry,
      (await getJournalByCodeQuery(organization.id, "BQ"))!.id,
      organization.id,
    );
    expect(paymentPayload.payload.isBalanced).toBe(true);
  });
});
