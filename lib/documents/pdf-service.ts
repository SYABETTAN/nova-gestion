import type { DocumentType } from "@prisma/client";
import { uploadAndCreateDocument } from "@/lib/documents/document-storage";
import { generateInvoicePdfBuffer } from "@/lib/pdf/invoice-pdf";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote-pdf";
import { organizationNameForDocuments } from "@/lib/organization-display";
import type { MoneyInput } from "@/lib/money";
import { moneyToNumber } from "@/lib/money";
import { isBillableLineType } from "@/lib/quote-calculations";
import type { QuoteLineType } from "@prisma/client";

type InvoiceForPdf = {
  id: string;
  invoiceNumber: string;
  title: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  totalExcludingTax: unknown;
  totalVatAmount: unknown;
  totalIncludingTax: unknown;
  amountDue: unknown;
  customer: { name: string };
  organization: { name: string; legalName?: string | null; slug?: string | null };
  lines: Array<{
    name: string;
    lineType: string;
    quantity: unknown;
    unitPriceExcludingTax: unknown;
    totalExcludingTax: unknown;
    vatRate: unknown;
  }>;
};

type QuoteForPdf = {
  id: string;
  quoteNumber: string;
  title: string;
  issueDate: Date;
  validUntil: Date;
  currency: string;
  totalExcludingTax: unknown;
  totalVatAmount: unknown;
  totalIncludingTax: unknown;
  customer: { name: string };
  organization: { name: string; legalName?: string | null; slug?: string | null };
  lines: Array<{
    name: string;
    lineType: QuoteLineType;
    quantity: unknown;
    unitPriceExcludingTax: unknown;
    totalExcludingTax: unknown;
  }>;
};

export async function storeInvoicePdf(params: {
  invoice: InvoiceForPdf;
  organizationId: string;
  userId: string;
}) {
  const { invoice, organizationId, userId } = params;
  const billableLines = invoice.lines.filter((l) =>
    isBillableLineType(l.lineType as QuoteLineType),
  );

  const buffer = await generateInvoicePdfBuffer({
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.title,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    customerName: invoice.customer.name,
    organizationName: organizationNameForDocuments(invoice.organization),
    lines: billableLines.map((l) => ({
      name: l.name,
      quantity: l.quantity as MoneyInput,
      unitPriceExcludingTax: l.unitPriceExcludingTax as MoneyInput,
      totalExcludingTax: l.totalExcludingTax as MoneyInput,
      vatRate: l.vatRate as MoneyInput,
    })),
    totalExcludingTax: invoice.totalExcludingTax as MoneyInput,
    totalVatAmount: invoice.totalVatAmount as MoneyInput,
    totalIncludingTax: invoice.totalIncludingTax as MoneyInput,
    amountDue: invoice.amountDue as MoneyInput,
  });

  const fileName = `facture-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

  return uploadAndCreateDocument({
    organizationId,
    userId,
    type: "INVOICE",
    title: `Facture ${invoice.invoiceNumber}`,
    fileName,
    mimeType: "application/pdf",
    buffer,
    entityType: "Invoice",
    entityId: invoice.id,
    category: "invoices",
  });
}

export async function storeQuotePdf(params: {
  quote: QuoteForPdf;
  organizationId: string;
  userId: string;
}) {
  const { quote, organizationId, userId } = params;
  const billableLines = quote.lines.filter((l) => isBillableLineType(l.lineType));

  const buffer = await generateQuotePdfBuffer({
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    currency: quote.currency,
    customerName: quote.customer.name,
    organizationName: organizationNameForDocuments(quote.organization),
    lines: billableLines.map((l) => ({
      name: l.name,
      quantity: l.quantity as MoneyInput,
      unitPriceExcludingTax: l.unitPriceExcludingTax as MoneyInput,
      totalExcludingTax: l.totalExcludingTax as MoneyInput,
    })),
    totalExcludingTax: quote.totalExcludingTax as MoneyInput,
    totalVatAmount: quote.totalVatAmount as MoneyInput,
    totalIncludingTax: quote.totalIncludingTax as MoneyInput,
  });

  const fileName = `devis-${quote.quoteNumber.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

  return uploadAndCreateDocument({
    organizationId,
    userId,
    type: "QUOTE",
    title: `Devis ${quote.quoteNumber}`,
    fileName,
    mimeType: "application/pdf",
    buffer,
    entityType: "Quote",
    entityId: quote.id,
    category: "quotes",
  });
}

export async function findLatestEntityPdf(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  type: DocumentType;
}) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.document.findFirst({
    where: {
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      type: params.type,
      status: { not: "ARCHIVED" },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function pdfAttachmentFromBuffer(fileName: string, buffer: Buffer) {
  return {
    filename: fileName,
    content: buffer,
  };
}

export { moneyToNumber };
