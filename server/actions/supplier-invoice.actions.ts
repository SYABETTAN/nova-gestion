"use server";

import { revalidatePath } from "next/cache";
import type { SupplierInvoiceActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import { generateSupplierInvoicesCsv } from "@/lib/csv";
import { calculateSupplierInvoiceTotals } from "@/lib/supplier-invoice-calculations";
import { isSupplierInvoiceEditable } from "@/lib/supplier-invoice-status";
import {
  createSupplierInvoiceSchema,
  supplierInvoiceFilterSchema,
  updateSupplierInvoiceSchema,
  type SupplierInvoiceLineInput,
} from "@/lib/supplier-invoice-validators";
import { computeSupplierInvoiceStats } from "@/lib/supplier-invoice-utils";
import {
  getSupplierInvoiceByIdQuery,
  getSupplierInvoiceFormDataQuery,
  getSupplierInvoiceStatsQuery,
  getSupplierInvoicesForExportQuery,
  listSupplierInvoicesQuery,
} from "@/lib/supplier-invoices";
import {
  mapMoneyFieldsToDb,
  SUPPLIER_INVOICE_LINE_MONEY_FIELDS,
  SUPPLIER_INVOICE_TOTAL_FIELDS,
} from "@/lib/money-db";
import { moneyToNumber, toDbDecimal } from "@/lib/money";

function emptyToNull(value?: string | null): string | null {
  if (value === undefined || value === null || value === "" || value === "none") return null;
  return String(value);
}

async function createActivity(
  organizationId: string,
  supplierInvoiceId: string,
  type: SupplierInvoiceActivityType,
  title: string,
  description?: string | null,
  userId?: string | null,
) {
  await prisma.supplierInvoiceActivity.create({
    data: {
      organizationId,
      supplierInvoiceId,
      userId: userId ?? null,
      type,
      title,
      description: description ?? null,
    },
  });
}

function parseFormInput(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  let lines: unknown = [];
  let attachments: unknown = [];
  if (typeof raw.lines === "string") {
    try { lines = JSON.parse(raw.lines); } catch { lines = []; }
  }
  if (typeof raw.attachments === "string") {
    try { attachments = JSON.parse(raw.attachments); } catch { attachments = []; }
  }
  return { ...raw, lines, attachments };
}

function buildLineCreates(
  organizationId: string,
  supplierInvoiceId: string,
  lines: SupplierInvoiceLineInput[],
  totals: ReturnType<typeof calculateSupplierInvoiceTotals>,
) {
  return totals.lines.map((line, index) =>
    mapMoneyFieldsToDb(
      {
        organizationId,
        supplierInvoiceId,
        expenseCategoryId: emptyToNull(lines[index]?.expenseCategoryId),
        position: lines[index]?.position ?? index,
        reference: emptyToNull(lines[index]?.reference),
        name: lines[index]?.name ?? "",
        description: emptyToNull(lines[index]?.description),
        quantity: line.quantity,
        unit: lines[index]?.unit ?? "unité",
        unitPriceExcludingTax: line.unitPriceExcludingTax,
        discountAmount: line.discountAmount,
        vatRate: line.vatRate,
        totalExcludingTax: line.totalExcludingTax,
        totalVatAmount: line.totalVatAmount,
        totalIncludingTax: line.totalIncludingTax,
      },
      [...SUPPLIER_INVOICE_LINE_MONEY_FIELDS],
    ),
  );
}

function mapSupplierInvoiceTotalsForDb(
  totals: ReturnType<typeof calculateSupplierInvoiceTotals>,
  extras: { defaultVatRate: number; amountPaid?: number; amountDue?: number },
) {
  return {
    ...mapMoneyFieldsToDb(
      {
        subtotalExcludingTax: totals.subtotalExcludingTax,
        totalDiscountAmount: totals.totalDiscountAmount,
        totalExcludingTax: totals.totalExcludingTax,
        totalVatAmount: totals.totalVatAmount,
        totalIncludingTax: totals.totalIncludingTax,
        amountPaid: extras.amountPaid ?? 0,
        amountDue: extras.amountDue ?? totals.totalIncludingTax,
      },
      [...SUPPLIER_INVOICE_TOTAL_FIELDS],
    ),
    defaultVatRate: toDbDecimal(extras.defaultVatRate),
  };
}

export async function listSupplierInvoicesAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_READ");
  const parsed = supplierInvoiceFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  return listSupplierInvoicesQuery(user.organizationId, filters);
}

export async function getSupplierInvoiceStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_READ");
  const invoices = await getSupplierInvoiceStatsQuery(user.organizationId);
  return computeSupplierInvoiceStats(invoices);
}

export async function getSupplierInvoiceByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_READ");
  return getSupplierInvoiceByIdQuery(user.organizationId, id);
}

export async function getSupplierInvoiceFormDataAction() {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_READ");
  return getSupplierInvoiceFormDataQuery(user.organizationId);
}

export async function createSupplierInvoiceAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_CREATE");

  const parsed = createSupplierInvoiceSchema.safeParse(parseFormInput(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const supplier = await prisma.supplier.findFirst({
    where: { id: data.supplierId, organizationId: user.organizationId },
  });
  if (!supplier) return { success: false, error: "Fournisseur introuvable" };

  const totals = calculateSupplierInvoiceTotals(
    data.lines.map((l) => ({
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountAmount: l.discountAmount,
      vatRate: l.vatRate,
    })),
    0,
  );

  const supplierInvoiceNumber = await generateNextNumber(
    user.organizationId,
    "SUPPLIER_INVOICE",
    user.id,
  );

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.supplierInvoice.create({
      data: {
        organizationId: user.organizationId,
        supplierInvoiceNumber,
        supplierReference: emptyToNull(data.supplierReference),
        supplierId: data.supplierId,
        type: data.type,
        title: data.title,
        description: emptyToNull(data.description),
        issueDate: data.issueDate,
        receivedDate: data.receivedDate,
        dueDate: data.dueDate,
        currency: data.currency,
        paymentTermsDays: data.paymentTermsDays,
        expenseCategoryId: emptyToNull(data.expenseCategoryId),
        paymentMethodPlaceholder: data.paymentMethodPlaceholder ?? null,
        internalNotes: emptyToNull(data.internalNotes),
        ...mapSupplierInvoiceTotalsForDb(totals, { defaultVatRate: data.defaultVatRate }),
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await tx.supplierInvoiceLine.createMany({
      data: buildLineCreates(user.organizationId, created.id, data.lines, totals),
    });

    await tx.supplierInvoiceActivity.create({
      data: {
        organizationId: user.organizationId,
        supplierInvoiceId: created.id,
        userId: user.id,
        type: "CREATED",
        title: "Facture fournisseur créée",
      },
    });

    await tx.supplierActivity.create({
      data: {
        organizationId: user.organizationId,
        supplierId: data.supplierId,
        type: "SUPPLIER_INVOICE_PLACEHOLDER",
        title: `Facture ${supplierInvoiceNumber} enregistrée`,
        amount: totals.totalIncludingTax,
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_CREATED",
    entityType: "SupplierInvoice",
    entityId: invoice.id,
    entityLabel: `${invoice.supplierInvoiceNumber} — ${data.title}`,
  });

  revalidatePath("/supplier-invoices");
  revalidatePath(`/suppliers/${data.supplierId}`);
  return { success: true, supplierInvoiceId: invoice.id };
}

export async function updateSupplierInvoiceAction(id: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  const existing = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Facture introuvable" };
  if (!isSupplierInvoiceEditable(existing.status)) {
    return { success: false, error: "Seules les factures brouillon peuvent être modifiées" };
  }

  const parsed = updateSupplierInvoiceSchema.safeParse(parseFormInput(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const totals = calculateSupplierInvoiceTotals(
    data.lines.map((l) => ({
      quantity: l.quantity,
      unitPriceExcludingTax: l.unitPriceExcludingTax,
      discountAmount: l.discountAmount,
      vatRate: l.vatRate,
    })),
    existing.amountPaid,
  );

  await prisma.$transaction(async (tx) => {
    await tx.supplierInvoiceLine.deleteMany({ where: { supplierInvoiceId: id } });
    await tx.supplierInvoice.update({
      where: { id },
      data: {
        supplierReference: emptyToNull(data.supplierReference),
        supplierId: data.supplierId,
        type: data.type,
        title: data.title,
        description: emptyToNull(data.description),
        issueDate: data.issueDate,
        receivedDate: data.receivedDate,
        dueDate: data.dueDate,
        currency: data.currency,
        paymentTermsDays: data.paymentTermsDays,
        expenseCategoryId: emptyToNull(data.expenseCategoryId),
        paymentMethodPlaceholder: data.paymentMethodPlaceholder ?? null,
        internalNotes: emptyToNull(data.internalNotes),
        ...mapSupplierInvoiceTotalsForDb(totals, {
          defaultVatRate: data.defaultVatRate,
          amountDue: totals.amountDue,
        }),
        updatedById: user.id,
      },
    });

    await tx.supplierInvoiceLine.createMany({
      data: buildLineCreates(user.organizationId, id, data.lines, totals),
    });

    await tx.supplierInvoiceActivity.create({
      data: {
        organizationId: user.organizationId,
        supplierInvoiceId: id,
        userId: user.id,
        type: "UPDATED",
        title: "Facture fournisseur modifiée",
      },
    });
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_UPDATED",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: existing.supplierInvoiceNumber,
  });

  revalidatePath("/supplier-invoices");
  revalidatePath(`/supplier-invoices/${id}`);
  revalidatePath(`/supplier-invoices/${id}/edit`);
  return { success: true };
}

export async function archiveSupplierInvoiceAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  const existing = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Facture introuvable" };
  if (existing.isArchived) return { success: false, error: "Déjà archivée" };

  await prisma.supplierInvoice.update({
    where: { id },
    data: { isArchived: true, archivedAt: new Date() },
  });

  await createActivity(user.organizationId, id, "ARCHIVED", "Facture archivée", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_ARCHIVED",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: existing.supplierInvoiceNumber,
  });

  revalidatePath("/supplier-invoices");
  revalidatePath(`/supplier-invoices/${id}`);
  return { success: true };
}

export async function reactivateSupplierInvoiceAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  const existing = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Facture introuvable" };
  if (!existing.isArchived) return { success: false, error: "Non archivée" };

  await prisma.supplierInvoice.update({
    where: { id },
    data: { isArchived: false, archivedAt: null },
  });

  await createActivity(user.organizationId, id, "REACTIVATED", "Facture réactivée", null, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_REACTIVATED",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: existing.supplierInvoiceNumber,
  });

  revalidatePath("/supplier-invoices");
  revalidatePath(`/supplier-invoices/${id}`);
  return { success: true };
}

export async function exportSupplierInvoicesCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_EXPORT");

  const parsed = supplierInvoiceFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : {};
  const invoices = await getSupplierInvoicesForExportQuery(user.organizationId, filters);
  const csv = generateSupplierInvoicesCsv(invoices);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_EXPORTED",
    entityType: "SupplierInvoice",
    entityLabel: `${invoices.length} factures`,
  });

  return { success: true, csv, filename: "factures-fournisseurs.csv" };
}

export async function addSupplierInvoiceNoteAction(id: string, content: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  if (!content || content.length < 2) {
    return { success: false, error: "Note trop courte" };
  }

  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false, error: "Facture introuvable" };

  await createActivity(user.organizationId, id, "NOTE", "Note interne", content, user.id);
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_NOTE_CREATED",
    entityType: "SupplierInvoice",
    entityId: id,
    entityLabel: invoice.supplierInvoiceNumber,
  });

  revalidatePath(`/supplier-invoices/${id}`);
  return { success: true };
}
