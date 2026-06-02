"use server";

import { revalidatePath } from "next/cache";
import type { DiscountType, InvoiceActivityType, InvoiceLineType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import { generateInvoicesCsv } from "@/lib/csv";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { isInvoiceEditable } from "@/lib/invoice-status";
import {
  createInvoiceSchema,
  invoiceFilterSchema,
  updateInvoiceSchema,
  type InvoiceLineInput,
} from "@/lib/invoice-validators";
import {
  getCustomersForInvoiceFilterQuery,
  getInvoiceByIdQuery,
  getInvoiceByQuoteIdQuery,
  getInvoiceFormDataQuery,
  getInvoicesForExportQuery,
  getInvoiceStatsQuery,
  listInvoicesQuery,
} from "@/lib/invoices";
import { getQuoteByIdQuery } from "@/lib/quotes";
import { canConvertQuote } from "@/lib/quote-status";
import {
  mapMoneyFieldsToDb,
  INVOICE_LINE_MONEY_FIELDS,
  INVOICE_TOTAL_FIELDS,
} from "@/lib/money-db";
import { moneyToNumber } from "@/lib/money";

function emptyToNull(value?: string | null): string | null {
  if (value === undefined || value === null || value === "" || value === "none") return null;
  return String(value);
}

async function createInvoiceActivity(
  organizationId: string,
  invoiceId: string,
  type: InvoiceActivityType,
  title: string,
  description?: string | null,
  userId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await prisma.invoiceActivity.create({
    data: {
      organizationId,
      invoiceId,
      userId: userId ?? null,
      type,
      title,
      description: description ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function parseFormToInvoiceInput(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  let lines: unknown = [];
  if (typeof raw.lines === "string") {
    try {
      lines = JSON.parse(raw.lines);
    } catch {
      lines = [];
    }
  }
  return { ...raw, lines };
}

function buildTotals(data: {
  lines: InvoiceLineInput[];
  globalDiscountType: DiscountType | null;
  globalDiscountValue: number;
  shippingAmountExcludingTax: number;
  otherFeesExcludingTax: number;
  amountPaid?: number;
}) {
  return calculateInvoiceTotals({
    lines: data.lines.map((l) => ({
      lineType: l.lineType as InvoiceLineType,
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountType: l.discountType as DiscountType | null,
      discountValue: l.discountValue,
      vatRate: l.vatRate,
    })),
    globalDiscountType: data.globalDiscountType,
    globalDiscountValue: data.globalDiscountValue,
    shippingAmountExcludingTax: data.shippingAmountExcludingTax,
    otherFeesExcludingTax: data.otherFeesExcludingTax,
    amountPaid: data.amountPaid ?? 0,
  });
}

function buildLineCreates(
  organizationId: string,
  totals: ReturnType<typeof calculateInvoiceTotals>,
  lines: InvoiceLineInput[],
) {
  return totals.lines.map((line, index) =>
    mapMoneyFieldsToDb(
      {
        organizationId,
        itemId: emptyToNull(lines[index]?.itemId),
        quoteLineId: emptyToNull(lines[index]?.quoteLineId),
        lineType: line.lineType as InvoiceLineType,
        position: lines[index]?.position ?? index,
        reference: emptyToNull(lines[index]?.reference),
        name: lines[index]?.name ?? "",
        description: emptyToNull(lines[index]?.description),
        quantity: line.quantity,
        unit: lines[index]?.unit ?? "unité",
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
  );
}

function mapInvoiceTotalsForDb(
  totals: ReturnType<typeof calculateInvoiceTotals>,
  extras: {
    globalDiscountValue: number;
    shippingAmountExcludingTax: number;
    otherFeesExcludingTax: number;
    amountPaid?: number;
    amountDue?: number;
  },
) {
  return mapMoneyFieldsToDb(
    {
      subtotalExcludingTax: totals.subtotalExcludingTax,
      totalDiscountAmount: totals.totalDiscountAmount,
      totalExcludingTax: totals.totalExcludingTax,
      totalVatAmount: totals.totalVatAmount,
      totalIncludingTax: totals.totalIncludingTax,
      amountPaid: extras.amountPaid ?? totals.amountPaid,
      amountDue: extras.amountDue ?? totals.amountDue,
      globalDiscountValue: extras.globalDiscountValue,
      shippingAmountExcludingTax: extras.shippingAmountExcludingTax,
      otherFeesExcludingTax: extras.otherFeesExcludingTax,
    },
    [...INVOICE_TOTAL_FIELDS],
  );
}

function prismaLineToInvoiceInput(l: {
  id?: string;
  itemId: string | null;
  lineType: string;
  position: number;
  reference: string | null;
  name: string;
  description: string | null;
  quantity: import("@/lib/money").MoneyInput;
  unit: string;
  unitPriceExcludingTax: import("@/lib/money").MoneyInput;
  discountType: DiscountType | null;
  discountValue: import("@/lib/money").MoneyInput;
  vatRate: import("@/lib/money").MoneyInput;
  quoteLineId?: string | null;
}): InvoiceLineInput {
  return {
    itemId: l.itemId,
    quoteLineId: l.quoteLineId ?? l.id ?? null,
    lineType: l.lineType as InvoiceLineInput["lineType"],
    position: l.position,
    reference: l.reference,
    name: l.name,
    description: l.description,
    quantity: moneyToNumber(l.quantity),
    unit: l.unit,
    unitPriceExcludingTax: moneyToNumber(l.unitPriceExcludingTax),
    discountType: l.discountType,
    discountValue: moneyToNumber(l.discountValue),
    vatRate: moneyToNumber(l.vatRate),
  };
}

export async function listInvoicesAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");
  const parsed = invoiceFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  return listInvoicesQuery(user.organizationId, filters);
}

export async function getInvoiceStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");
  return getInvoiceStatsQuery(user.organizationId);
}

export async function getInvoiceByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");
  return getInvoiceByIdQuery(user.organizationId, id);
}

export async function getInvoiceFormDataAction() {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");
  return getInvoiceFormDataQuery(user.organizationId);
}

export async function getCustomersForInvoiceFilterAction() {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");
  return getCustomersForInvoiceFilterQuery(user.organizationId);
}

export async function createInvoiceAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_CREATE");

  const parsed = createInvoiceSchema.safeParse(parseFormToInvoiceInput(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const invoiceNumber = await generateNextNumber(user.organizationId, "INVOICE", user.id);
  const totals = buildTotals({
    lines: data.lines,
    globalDiscountType: data.globalDiscountType as DiscountType | null,
    globalDiscountValue: data.globalDiscountValue,
    shippingAmountExcludingTax: data.shippingAmountExcludingTax,
    otherFeesExcludingTax: data.otherFeesExcludingTax,
    amountPaid: data.amountPaid,
  });

  if (totals.amountPaid > totals.totalIncludingTax) {
    return { success: false, error: "Le montant payé ne peut pas dépasser le total TTC" };
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        organizationId: user.organizationId,
        invoiceNumber,
        customerId: data.customerId,
        customerContactId: emptyToNull(data.customerContactId),
        billingAddressId: emptyToNull(data.billingAddressId),
        shippingAddressId: emptyToNull(data.shippingAddressId),
        type: data.type,
        status: "DRAFT",
        paymentStatus: totals.amountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID",
        title: data.title,
        subject: emptyToNull(data.subject),
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        currency: data.currency,
        language: data.language,
        paymentTermsDays: data.paymentTermsDays,
        introductionText: emptyToNull(data.introductionText),
        footerText: emptyToNull(data.footerText),
        internalNotes: emptyToNull(data.internalNotes),
        customerNotes: emptyToNull(data.customerNotes),
        ...mapInvoiceTotalsForDb(totals, {
          globalDiscountValue: data.globalDiscountValue,
          shippingAmountExcludingTax: data.shippingAmountExcludingTax,
          otherFeesExcludingTax: data.otherFeesExcludingTax,
        }),
        globalDiscountType: data.globalDiscountType as DiscountType | null,
        createdById: user.id,
        updatedById: user.id,
        lines: { create: buildLineCreates(user.organizationId, totals, data.lines) },
      },
    });

    await tx.invoiceActivity.create({
      data: {
        organizationId: user.organizationId,
        invoiceId: created.id,
        userId: user.id,
        type: "CREATED",
        title: "Facture créée",
        description: `Facture ${invoiceNumber} créée en brouillon`,
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_CREATED",
    entityType: "Invoice",
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/invoices");
  return { success: true, invoiceId: invoice.id };
}

export async function createInvoiceFromQuoteAction(quoteId: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_CREATE");

  const quote = await getQuoteByIdQuery(user.organizationId, quoteId);
  if (!quote) return { success: false, error: "Devis introuvable" };
  if (!canConvertQuote(quote.status)) {
    return { success: false, error: "Seuls les devis acceptés peuvent être convertis en facture." };
  }

  const existing = await getInvoiceByQuoteIdQuery(user.organizationId, quoteId);
  if (existing) {
    return {
      success: true,
      invoiceId: existing.id,
      message: `Une facture existe déjà pour ce devis (${existing.invoiceNumber}).`,
    };
  }

  const invoiceNumber = await generateNextNumber(user.organizationId, "INVOICE", user.id);
  const dueDate = new Date(quote.issueDate);
  dueDate.setDate(dueDate.getDate() + quote.paymentTermsDays);

  const lineInputs: InvoiceLineInput[] = quote.lines.map((l) =>
    prismaLineToInvoiceInput({ ...l, quoteLineId: l.id }),
  );

  const totals = buildTotals({
    lines: lineInputs,
    globalDiscountType: quote.globalDiscountType,
    globalDiscountValue: moneyToNumber(quote.globalDiscountValue),
    shippingAmountExcludingTax: moneyToNumber(quote.shippingAmountExcludingTax),
    otherFeesExcludingTax: moneyToNumber(quote.otherFeesExcludingTax),
    amountPaid: 0,
  });

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        organizationId: user.organizationId,
        invoiceNumber,
        customerId: quote.customerId,
        customerContactId: quote.customerContactId,
        billingAddressId: quote.billingAddressId,
        shippingAddressId: quote.shippingAddressId,
        quoteId: quote.id,
        type: "STANDARD",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        title: quote.title,
        subject: quote.subject,
        issueDate: new Date(),
        dueDate,
        currency: quote.currency,
        language: quote.language,
        paymentTermsDays: quote.paymentTermsDays,
        introductionText: quote.introductionText,
        footerText: quote.footerText,
        internalNotes: quote.internalNotes,
        customerNotes: quote.customerNotes,
        ...mapInvoiceTotalsForDb(totals, {
          globalDiscountValue: moneyToNumber(quote.globalDiscountValue),
          shippingAmountExcludingTax: moneyToNumber(quote.shippingAmountExcludingTax),
          otherFeesExcludingTax: moneyToNumber(quote.otherFeesExcludingTax),
          amountPaid: 0,
          amountDue: totals.totalIncludingTax,
        }),
        globalDiscountType: quote.globalDiscountType,
        createdById: user.id,
        updatedById: user.id,
        lines: { create: buildLineCreates(user.organizationId, totals, lineInputs) },
      },
    });

    await tx.quote.update({
      where: { id: quoteId },
      data: { status: "CONVERTED", convertedToInvoiceAt: new Date() },
    });

    await tx.quoteActivity.create({
      data: {
        organizationId: user.organizationId,
        quoteId,
        userId: user.id,
        type: "CONVERTED",
        title: "Converti en facture",
        description: `Facture ${invoiceNumber} créée`,
      },
    });

    await tx.invoiceActivity.create({
      data: {
        organizationId: user.organizationId,
        invoiceId: created.id,
        userId: user.id,
        type: "CREATED_FROM_QUOTE",
        title: "Créée depuis devis",
        description: `Depuis le devis ${quote.quoteNumber}`,
        metadata: JSON.stringify({ quoteId, quoteNumber: quote.quoteNumber }),
      },
    });

    await tx.invoiceActivity.create({
      data: {
        organizationId: user.organizationId,
        invoiceId: created.id,
        userId: user.id,
        type: "CREATED",
        title: "Facture créée",
        description: `Facture ${invoiceNumber} en brouillon`,
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_CREATED_FROM_QUOTE",
    entityType: "Invoice",
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
    newValues: { quoteId, quoteNumber: quote.quoteNumber },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_CONVERTED",
    entityType: "Quote",
    entityId: quoteId,
    entityLabel: quote.quoteNumber,
    newValues: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/invoices");
  return { success: true, invoiceId: invoice.id, message: "Facture créée depuis le devis." };
}

export async function updateInvoiceAction(id: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_UPDATE");

  const existing = await prisma.invoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Facture introuvable" };
  if (!isInvoiceEditable(existing.status)) {
    return { success: false, error: "Cette facture est verrouillée et ne peut plus être modifiée." };
  }

  const parsed = updateInvoiceSchema.safeParse(parseFormToInvoiceInput(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const totals = buildTotals({
    lines: data.lines,
    globalDiscountType: data.globalDiscountType as DiscountType | null,
    globalDiscountValue: data.globalDiscountValue,
    shippingAmountExcludingTax: data.shippingAmountExcludingTax,
    otherFeesExcludingTax: data.otherFeesExcludingTax,
    amountPaid: data.amountPaid,
  });

  if (totals.amountPaid > totals.totalIncludingTax) {
    return { success: false, error: "Le montant payé ne peut pas dépasser le total TTC" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id, organizationId: user.organizationId } });
    await tx.invoice.update({
      where: { id },
      data: {
        customerId: data.customerId,
        customerContactId: emptyToNull(data.customerContactId),
        billingAddressId: emptyToNull(data.billingAddressId),
        shippingAddressId: emptyToNull(data.shippingAddressId),
        type: data.type,
        title: data.title,
        subject: emptyToNull(data.subject),
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        currency: data.currency,
        language: data.language,
        paymentTermsDays: data.paymentTermsDays,
        introductionText: emptyToNull(data.introductionText),
        footerText: emptyToNull(data.footerText),
        internalNotes: emptyToNull(data.internalNotes),
        customerNotes: emptyToNull(data.customerNotes),
        ...mapInvoiceTotalsForDb(totals, {
          globalDiscountValue: data.globalDiscountValue,
          shippingAmountExcludingTax: data.shippingAmountExcludingTax,
          otherFeesExcludingTax: data.otherFeesExcludingTax,
        }),
        paymentStatus:
          totals.amountPaid >= totals.totalIncludingTax
            ? "PAID"
            : totals.amountPaid > 0
              ? "PARTIALLY_PAID"
              : "UNPAID",
        globalDiscountType: data.globalDiscountType as DiscountType | null,
        updatedById: user.id,
        lines: { create: buildLineCreates(user.organizationId, totals, data.lines) },
      },
    });

    await tx.invoiceActivity.create({
      data: {
        organizationId: user.organizationId,
        invoiceId: id,
        userId: user.id,
        type: "UPDATED",
        title: "Facture modifiée",
        description: `Facture ${existing.invoiceNumber} mise à jour`,
      },
    });
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_UPDATED",
    entityType: "Invoice",
    entityId: id,
    entityLabel: existing.invoiceNumber,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true, invoiceId: id };
}

export async function archiveInvoiceAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_CANCEL");

  const invoice = await prisma.invoice.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!invoice) return { success: false, error: "Facture introuvable" };

  await prisma.invoice.update({ where: { id }, data: { isArchived: true, archivedAt: new Date() } });
  await createInvoiceActivity(user.organizationId, id, "ARCHIVED", "Facture archivée", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_ARCHIVED",
    entityType: "Invoice",
    entityId: id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/invoices");
  return { success: true };
}

export async function reactivateInvoiceAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_CANCEL");

  const invoice = await prisma.invoice.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!invoice) return { success: false, error: "Facture introuvable" };

  await prisma.invoice.update({ where: { id }, data: { isArchived: false, archivedAt: null } });
  await createInvoiceActivity(user.organizationId, id, "REACTIVATED", "Facture réactivée", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_REACTIVATED",
    entityType: "Invoice",
    entityId: id,
    entityLabel: invoice.invoiceNumber,
  });

  revalidatePath("/invoices");
  return { success: true };
}

export async function duplicateInvoiceAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_CREATE");

  const source = await getInvoiceByIdQuery(user.organizationId, id);
  if (!source) return { success: false, error: "Facture introuvable" };

  const invoiceNumber = await generateNextNumber(user.organizationId, "INVOICE", user.id);
  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + source.paymentTermsDays);

  const lineInputs: InvoiceLineInput[] = source.lines.map((l) => prismaLineToInvoiceInput(l));

  const totals = buildTotals({
    lines: lineInputs,
    globalDiscountType: source.globalDiscountType,
    globalDiscountValue: moneyToNumber(source.globalDiscountValue),
    shippingAmountExcludingTax: moneyToNumber(source.shippingAmountExcludingTax),
    otherFeesExcludingTax: moneyToNumber(source.otherFeesExcludingTax),
    amountPaid: 0,
  });

  const duplicate = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        organizationId: user.organizationId,
        invoiceNumber,
        customerId: source.customerId,
        customerContactId: source.customerContactId,
        billingAddressId: source.billingAddressId,
        shippingAddressId: source.shippingAddressId,
        type: source.type,
        status: "DRAFT",
        paymentStatus: "UNPAID",
        title: `${source.title} — Copie`,
        subject: source.subject,
        issueDate,
        dueDate,
        currency: source.currency,
        language: source.language,
        paymentTermsDays: source.paymentTermsDays,
        introductionText: source.introductionText,
        footerText: source.footerText,
        internalNotes: source.internalNotes,
        customerNotes: source.customerNotes,
        ...mapInvoiceTotalsForDb(totals, {
          globalDiscountValue: moneyToNumber(source.globalDiscountValue),
          shippingAmountExcludingTax: moneyToNumber(source.shippingAmountExcludingTax),
          otherFeesExcludingTax: moneyToNumber(source.otherFeesExcludingTax),
          amountPaid: 0,
          amountDue: totals.totalIncludingTax,
        }),
        globalDiscountType: source.globalDiscountType,
        createdById: user.id,
        updatedById: user.id,
        lines: { create: buildLineCreates(user.organizationId, totals, lineInputs) },
      },
    });

    await tx.invoiceActivity.create({
      data: {
        organizationId: user.organizationId,
        invoiceId: created.id,
        userId: user.id,
        type: "CREATED",
        title: "Facture dupliquée",
        description: `Copie de ${source.invoiceNumber}`,
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_DUPLICATED",
    entityType: "Invoice",
    entityId: duplicate.id,
    entityLabel: duplicate.invoiceNumber,
    newValues: { sourceInvoiceId: id },
  });

  revalidatePath("/invoices");
  return { success: true, invoiceId: duplicate.id };
}

export async function exportInvoicesCsvAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");

  const parsed = invoiceFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : {};
  const invoices = await getInvoicesForExportQuery(user.organizationId, filters);
  const csv = generateInvoicesCsv(invoices);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVOICE_EXPORTED",
    entityType: "Invoice",
    entityLabel: `${invoices.length} factures exportées`,
  });

  return { success: true, csv, filename: "factures.csv" };
}
