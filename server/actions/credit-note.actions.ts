"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import { calculateCreditNoteLineTotals } from "@/lib/invoice-calculations";
import { canCreateCreditNote } from "@/lib/invoice-status";
import { createCreditNoteSchema } from "@/lib/invoice-validators";
import { getCreditNoteByIdQuery } from "@/lib/invoices";
import {
  mapMoneyFieldsToDb,
  CREDIT_NOTE_LINE_MONEY_FIELDS,
  CREDIT_NOTE_MONEY_FIELDS,
} from "@/lib/money-db";
import type { Prisma } from "@prisma/client";
import { money, moneyAdd, roundMoney as roundMoneyDecimal } from "@/lib/money";
import { roundMoney } from "@/lib/pricing";

export async function getCreditNoteByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");
  return getCreditNoteByIdQuery(user.organizationId, id);
}

export async function createCreditNoteFromInvoiceAction(invoiceId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_VALIDATE");

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
    include: { lines: { orderBy: { position: "asc" } } },
  });

  if (!invoice) return { success: false, error: "Facture introuvable" };
  if (!canCreateCreditNote(invoice.status)) {
    return { success: false, error: "Cette facture ne peut pas faire l'objet d'un avoir" };
  }

  const parsed = createCreditNoteSchema.safeParse({
    invoiceId,
    ...Object.fromEntries(formData.entries()),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;

  if (
    data.type === "PARTIAL" &&
    roundMoneyDecimal(money(data.partialAmount!)).greaterThan(
      roundMoneyDecimal(invoice.totalIncludingTax),
    )
  ) {
    return { success: false, error: "Le montant de l'avoir ne peut pas dépasser le total de la facture" };
  }

  const creditNoteNumber = await generateNextNumber(user.organizationId, "CREDIT_NOTE", user.id);

  let lineCreates: Prisma.CreditNoteLineCreateWithoutCreditNoteInput[] = [];

  let totalExcludingTax = 0;
  let totalVatAmount = 0;
  let totalIncludingTax = 0;

  if (data.type === "TOTAL") {
    for (const line of invoice.lines) {
      if (line.lineType === "SECTION" || line.lineType === "COMMENT") continue;
      lineCreates.push(
        mapMoneyFieldsToDb(
          {
            organizationId: user.organizationId,
            invoiceLineId: line.id,
            position: line.position,
            name: line.name,
            description: line.description,
            quantity: line.quantity,
            unitPriceExcludingTax: line.unitPriceExcludingTax,
            vatRate: line.vatRate,
            totalExcludingTax: line.totalExcludingTax,
            totalVatAmount: line.totalVatAmount,
            totalIncludingTax: line.totalIncludingTax,
          },
          [...CREDIT_NOTE_LINE_MONEY_FIELDS],
        ) as unknown as Prisma.CreditNoteLineCreateWithoutCreditNoteInput,
      );
      totalExcludingTax = roundMoney(moneyAdd(totalExcludingTax, line.totalExcludingTax));
      totalVatAmount = roundMoney(moneyAdd(totalVatAmount, line.totalVatAmount));
      totalIncludingTax = roundMoney(moneyAdd(totalIncludingTax, line.totalIncludingTax));
    }
  } else {
    const partialTtc = data.partialAmount!;
    const vatRate = 20;
    const ht = roundMoney(partialTtc / (1 + vatRate / 100));
    const calc = calculateCreditNoteLineTotals({
      quantity: 1,
      unitPriceExcludingTax: ht,
      vatRate,
    });
    lineCreates = [
      mapMoneyFieldsToDb(
        {
          organizationId: user.organizationId,
          invoiceLineId: null,
          position: 0,
          name: "Avoir partiel",
          description: data.reason,
          quantity: 1,
          unitPriceExcludingTax: ht,
          vatRate,
          ...calc,
        },
        [...CREDIT_NOTE_LINE_MONEY_FIELDS],
      ) as unknown as Prisma.CreditNoteLineCreateWithoutCreditNoteInput,
    ];
    totalExcludingTax = calc.totalExcludingTax;
    totalVatAmount = calc.totalVatAmount;
    totalIncludingTax = calc.totalIncludingTax;
  }

  const creditNoteTotals = mapMoneyFieldsToDb(
    { totalExcludingTax, totalVatAmount, totalIncludingTax },
    [...CREDIT_NOTE_MONEY_FIELDS],
  );

  const creditNote = await prisma.$transaction(async (tx) => {
    const created = await tx.creditNote.create({
      data: {
        organizationId: user.organizationId,
        creditNoteNumber,
        invoiceId,
        customerId: invoice.customerId,
        status: "VALIDATED",
        issueDate: new Date(),
        reason: data.reason,
        ...creditNoteTotals,
        createdById: user.id,
        lines: { create: lineCreates },
      },
    });

    if (data.type === "TOTAL") {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "CREDITED", creditedAt: new Date() },
      });
    }

    await tx.invoiceActivity.create({
      data: {
        organizationId: user.organizationId,
        invoiceId,
        userId: user.id,
        type: "CREDIT_NOTE_CREATED",
        title: "Avoir créé",
        description: `${creditNoteNumber} — ${data.reason}`,
        metadata: JSON.stringify({ creditNoteId: created.id, type: data.type }),
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CREDIT_NOTE_CREATED",
    entityType: "CreditNote",
    entityId: creditNote.id,
    entityLabel: creditNoteNumber,
    newValues: { invoiceId, type: data.type },
  });

  if (data.type === "TOTAL") {
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "INVOICE_CREDITED",
      entityType: "Invoice",
      entityId: invoiceId,
      entityLabel: invoice.invoiceNumber,
    });
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true, creditNoteId: creditNote.id, message: "Avoir créé avec succès." };
}

export async function cancelCreditNoteAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_CANCEL");

  const creditNote = await prisma.creditNote.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!creditNote) return { success: false, error: "Avoir introuvable" };
  if (creditNote.status === "CANCELLED") {
    return { success: false, error: "Avoir déjà annulé" };
  }

  await prisma.creditNote.update({ where: { id }, data: { status: "CANCELLED" } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CREDIT_NOTE_CANCELLED",
    entityType: "CreditNote",
    entityId: id,
    entityLabel: creditNote.creditNoteNumber,
  });

  revalidatePath(`/credit-notes/${id}`);
  revalidatePath(`/invoices/${creditNote.invoiceId}`);
  return { success: true };
}
