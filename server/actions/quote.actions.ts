"use server";

import { revalidatePath } from "next/cache";
import type { DiscountType, QuoteActivityType, QuoteLineType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import { generateQuotesCsv } from "@/lib/csv";
import { calculateQuoteTotals } from "@/lib/quote-calculations";
import { isQuoteEditable, isQuoteEditableWithConfirmation } from "@/lib/quote-status";
import {
  createQuoteSchema,
  quoteFilterSchema,
  updateQuoteSchema,
  type QuoteLineInput,
} from "@/lib/quote-validators";
import {
  getCustomersForFilterQuery,
  getQuoteByIdQuery,
  getQuoteFormDataQuery,
  getQuotesForExportQuery,
  getQuoteStatsQuery,
  listQuotesQuery,
} from "@/lib/quotes";
import {
  mapMoneyFieldsToDb,
  INVOICE_LINE_MONEY_FIELDS,
  QUOTE_TOTAL_FIELDS,
} from "@/lib/money-db";

function emptyToNull(value?: string | null): string | null {
  if (value === undefined || value === null || value === "" || value === "none") return null;
  return String(value);
}

async function createQuoteActivity(
  organizationId: string,
  quoteId: string,
  type: QuoteActivityType,
  title: string,
  description?: string | null,
  userId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await prisma.quoteActivity.create({
    data: {
      organizationId,
      quoteId,
      userId: userId ?? null,
      type,
      title,
      description: description ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function parseFormToQuoteInput(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const linesRaw = raw.lines;
  let lines: unknown = [];

  if (typeof linesRaw === "string") {
    try {
      lines = JSON.parse(linesRaw);
    } catch {
      lines = [];
    }
  }

  return {
    ...raw,
    lines,
  };
}

function buildQuoteLineCreates(
  organizationId: string,
  totals: ReturnType<typeof calculateQuoteTotals>,
  lines: QuoteLineInput[],
) {
  return totals.lines.map((line, index) =>
    mapMoneyFieldsToDb(
      {
        organizationId,
        itemId: emptyToNull(lines[index]?.itemId),
        lineType: line.lineType,
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

function mapQuoteTotalsForDb(
  totals: ReturnType<typeof calculateQuoteTotals>,
  extras: {
    globalDiscountValue: number;
    shippingAmountExcludingTax: number;
    otherFeesExcludingTax: number;
  },
) {
  return mapMoneyFieldsToDb(
    {
      subtotalExcludingTax: totals.subtotalExcludingTax,
      totalDiscountAmount: totals.totalDiscountAmount,
      totalExcludingTax: totals.totalExcludingTax,
      totalVatAmount: totals.totalVatAmount,
      totalIncludingTax: totals.totalIncludingTax,
      globalDiscountValue: extras.globalDiscountValue,
      shippingAmountExcludingTax: extras.shippingAmountExcludingTax,
      otherFeesExcludingTax: extras.otherFeesExcludingTax,
    },
    [...QUOTE_TOTAL_FIELDS],
  );
}

export async function listQuotesAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_READ");

  const parsed = quoteFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

  return listQuotesQuery(user.organizationId, filters);
}

export async function getQuoteStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_READ");
  return getQuoteStatsQuery(user.organizationId);
}

export async function getQuoteByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_READ");

  return getQuoteByIdQuery(user.organizationId, id);
}

export async function getQuoteFormDataAction() {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_READ");

  return getQuoteFormDataQuery(user.organizationId);
}

export async function getCustomersForQuoteFilterAction() {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_READ");

  return getCustomersForFilterQuery(user.organizationId);
}

export async function createQuoteAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_CREATE");

  const parsed = createQuoteSchema.safeParse(parseFormToQuoteInput(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const quoteNumber = await generateNextNumber(user.organizationId, "QUOTE", user.id);

  const totals = calculateQuoteTotals({
    lines: data.lines.map((l) => ({
      lineType: l.lineType as QuoteLineType,
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountType: l.discountType as DiscountType | null,
      discountValue: l.discountValue,
      vatRate: l.vatRate,
    })),
    globalDiscountType: data.globalDiscountType as DiscountType | null,
    globalDiscountValue: data.globalDiscountValue,
    shippingAmountExcludingTax: data.shippingAmountExcludingTax,
    otherFeesExcludingTax: data.otherFeesExcludingTax,
  });

  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        organizationId: user.organizationId,
        quoteNumber,
        customerId: data.customerId,
        customerContactId: emptyToNull(data.customerContactId),
        billingAddressId: emptyToNull(data.billingAddressId),
        shippingAddressId: emptyToNull(data.shippingAddressId),
        status: "DRAFT",
        title: data.title,
        subject: emptyToNull(data.subject),
        issueDate: data.issueDate,
        validUntil: data.validUntil,
        currency: data.currency,
        language: data.language,
        paymentTermsDays: data.paymentTermsDays,
        introductionText: emptyToNull(data.introductionText),
        footerText: emptyToNull(data.footerText),
        internalNotes: emptyToNull(data.internalNotes),
        customerNotes: emptyToNull(data.customerNotes),
        ...mapQuoteTotalsForDb(totals, {
          globalDiscountValue: data.globalDiscountValue,
          shippingAmountExcludingTax: data.shippingAmountExcludingTax,
          otherFeesExcludingTax: data.otherFeesExcludingTax,
        }),
        globalDiscountType: data.globalDiscountType as DiscountType | null,
        createdById: user.id,
        updatedById: user.id,
        lines: {
          create: buildQuoteLineCreates(user.organizationId, totals, data.lines),
        },
      },
    });

    await tx.quoteActivity.create({
      data: {
        organizationId: user.organizationId,
        quoteId: created.id,
        userId: user.id,
        type: "CREATED",
        title: "Devis créé",
        description: `Devis ${quoteNumber} créé en brouillon`,
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_CREATED",
    entityType: "Quote",
    entityId: quote.id,
    entityLabel: quote.quoteNumber,
  });

  revalidatePath("/quotes");
  return { success: true, quoteId: quote.id };
}

export async function updateQuoteAction(id: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_UPDATE");

  const existing = await prisma.quote.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!existing) {
    return { success: false, error: "Devis introuvable" };
  }

  if (!isQuoteEditable(existing.status)) {
    return { success: false, error: "Ce devis ne peut plus être modifié" };
  }

  const confirmSentEdit = formData.get("confirmSentEdit") === "true";
  if (isQuoteEditableWithConfirmation(existing.status) && !confirmSentEdit) {
    return {
      success: false,
      error: "CONFIRM_SENT_EDIT",
      message: "Ce devis a déjà été envoyé. Confirmez la modification.",
    };
  }

  const parsed = updateQuoteSchema.safeParse(parseFormToQuoteInput(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;

  const totals = calculateQuoteTotals({
    lines: data.lines.map((l) => ({
      lineType: l.lineType as QuoteLineType,
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountType: l.discountType as DiscountType | null,
      discountValue: l.discountValue,
      vatRate: l.vatRate,
    })),
    globalDiscountType: data.globalDiscountType as DiscountType | null,
    globalDiscountValue: data.globalDiscountValue,
    shippingAmountExcludingTax: data.shippingAmountExcludingTax,
    otherFeesExcludingTax: data.otherFeesExcludingTax,
  });

  await prisma.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { quoteId: id, organizationId: user.organizationId } });

    await tx.quote.update({
      where: { id },
      data: {
        customerId: existing.status === "DRAFT" ? data.customerId : existing.customerId,
        customerContactId: emptyToNull(data.customerContactId),
        billingAddressId: emptyToNull(data.billingAddressId),
        shippingAddressId: emptyToNull(data.shippingAddressId),
        title: data.title,
        subject: emptyToNull(data.subject),
        issueDate: data.issueDate,
        validUntil: data.validUntil,
        currency: data.currency,
        language: data.language,
        paymentTermsDays: data.paymentTermsDays,
        introductionText: emptyToNull(data.introductionText),
        footerText: emptyToNull(data.footerText),
        internalNotes: emptyToNull(data.internalNotes),
        customerNotes: emptyToNull(data.customerNotes),
        ...mapQuoteTotalsForDb(totals, {
          globalDiscountValue: data.globalDiscountValue,
          shippingAmountExcludingTax: data.shippingAmountExcludingTax,
          otherFeesExcludingTax: data.otherFeesExcludingTax,
        }),
        globalDiscountType: data.globalDiscountType as DiscountType | null,
        updatedById: user.id,
        lines: {
          create: buildQuoteLineCreates(user.organizationId, totals, data.lines),
        },
      },
    });

    await tx.quoteActivity.create({
      data: {
        organizationId: user.organizationId,
        quoteId: id,
        userId: user.id,
        type: "UPDATED",
        title: "Devis modifié",
        description: `Devis ${existing.quoteNumber} mis à jour`,
      },
    });
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_UPDATED",
    entityType: "Quote",
    entityId: id,
    entityLabel: existing.quoteNumber,
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true, quoteId: id };
}

export async function archiveQuoteAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_DELETE");

  const quote = await prisma.quote.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!quote) return { success: false, error: "Devis introuvable" };

  await prisma.quote.update({
    where: { id },
    data: { isArchived: true, archivedAt: new Date() },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_ARCHIVED",
    entityType: "Quote",
    entityId: id,
    entityLabel: quote.quoteNumber,
  });

  revalidatePath("/quotes");
  return { success: true };
}

export async function reactivateQuoteAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_DELETE");

  const quote = await prisma.quote.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!quote) return { success: false, error: "Devis introuvable" };

  await prisma.quote.update({
    where: { id },
    data: { isArchived: false, archivedAt: null },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_REACTIVATED",
    entityType: "Quote",
    entityId: id,
    entityLabel: quote.quoteNumber,
  });

  revalidatePath("/quotes");
  return { success: true };
}

export async function duplicateQuoteAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_CREATE");

  const source = await getQuoteByIdQuery(user.organizationId, id);
  if (!source) return { success: false, error: "Devis introuvable" };

  const quoteNumber = await generateNextNumber(user.organizationId, "QUOTE", user.id);
  const issueDate = new Date();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const duplicate = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        organizationId: user.organizationId,
        quoteNumber,
        customerId: source.customerId,
        customerContactId: source.customerContactId,
        billingAddressId: source.billingAddressId,
        shippingAddressId: source.shippingAddressId,
        status: "DRAFT",
        title: `${source.title} — Copie`,
        subject: source.subject,
        issueDate,
        validUntil,
        currency: source.currency,
        language: source.language,
        paymentTermsDays: source.paymentTermsDays,
        introductionText: source.introductionText,
        footerText: source.footerText,
        internalNotes: source.internalNotes,
        customerNotes: source.customerNotes,
        subtotalExcludingTax: source.subtotalExcludingTax,
        totalDiscountAmount: source.totalDiscountAmount,
        totalExcludingTax: source.totalExcludingTax,
        totalVatAmount: source.totalVatAmount,
        totalIncludingTax: source.totalIncludingTax,
        globalDiscountType: source.globalDiscountType,
        globalDiscountValue: source.globalDiscountValue,
        shippingAmountExcludingTax: source.shippingAmountExcludingTax,
        otherFeesExcludingTax: source.otherFeesExcludingTax,
        createdById: user.id,
        updatedById: user.id,
        lines: {
          create: source.lines.map((line) => ({
            organizationId: user.organizationId,
            itemId: line.itemId,
            lineType: line.lineType,
            position: line.position,
            reference: line.reference,
            name: line.name,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPriceExcludingTax: line.unitPriceExcludingTax,
            discountType: line.discountType,
            discountValue: line.discountValue,
            discountAmount: line.discountAmount,
            vatRate: line.vatRate,
            totalExcludingTax: line.totalExcludingTax,
            totalVatAmount: line.totalVatAmount,
            totalIncludingTax: line.totalIncludingTax,
          })),
        },
      },
    });

    await tx.quoteActivity.create({
      data: {
        organizationId: user.organizationId,
        quoteId: created.id,
        userId: user.id,
        type: "DUPLICATED",
        title: "Devis dupliqué",
        description: `Copie de ${source.quoteNumber}`,
        metadata: JSON.stringify({ sourceQuoteId: source.id, sourceQuoteNumber: source.quoteNumber }),
      },
    });

    await tx.quoteActivity.create({
      data: {
        organizationId: user.organizationId,
        quoteId: created.id,
        userId: user.id,
        type: "CREATED",
        title: "Devis créé",
        description: `Devis ${quoteNumber} créé par duplication`,
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_DUPLICATED",
    entityType: "Quote",
    entityId: duplicate.id,
    entityLabel: duplicate.quoteNumber,
    newValues: { sourceQuoteId: id },
  });

  revalidatePath("/quotes");
  return { success: true, quoteId: duplicate.id };
}

export async function exportQuotesCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_READ");

  const parsed = quoteFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : {};

  const quotes = await getQuotesForExportQuery(user.organizationId, filters);
  const csv = generateQuotesCsv(quotes);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "QUOTE_EXPORTED",
    entityType: "Quote",
    entityLabel: `${quotes.length} devis exportés`,
  });

  return { success: true, csv, filename: "devis.csv" };
}

export async function addQuoteNoteAction(quoteId: string, note: string) {
  const user = await requireAuth();
  requirePermission(user, "QUOTES_UPDATE");

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, organizationId: user.organizationId },
  });

  if (!quote) return { success: false, error: "Devis introuvable" };

  await createQuoteActivity(
    user.organizationId,
    quoteId,
    "NOTE",
    "Note interne ajoutée",
    note,
    user.id,
  );

  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}
