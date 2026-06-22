import type { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moneyToNumber } from "@/lib/money";

export type SalesDocType = "INVOICE" | "QUOTE" | "CREDIT_NOTE";

export type SalesDetailRow = {
  id: string;
  docType: SalesDocType;
  docId: string;
  docNumber: string;
  docStatus: string;
  docDate: string;
  position: number;
  itemId: string | null;
  reference: string | null;
  name: string;
  description: string | null;
  customerId: string | null;
  customerName: string;
  customerCompany: string | null;
  country: string | null;
  quantity: number;
  unitPriceGrossHt: number;
  unitPriceNetHt: number;
  unitPriceTtc: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  vatRate: number;
  representativeName: string | null;
};

export type SalesDetailTotals = {
  lineCount: number;
  totalQuantity: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  distinctDocuments: number;
  distinctCustomers: number;
  distinctItems: number;
};

export type SalesDetailResult = {
  rows: SalesDetailRow[];
  totals: SalesDetailTotals;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  exercise: { from: string; to: string };
  representatives: { id: string; name: string }[];
  capped: boolean;
};

export type SalesDetailFilters = {
  customerId?: string;
  itemId?: string;
  representativeId?: string;
  from?: string;
  to?: string;
  criteria?: string;
  page?: number;
  pageSize?: number;
};

/** Plafond de lignes chargées pour le calcul des totaux (volume PME). */
const ROW_CAP = 5000;
const BILLABLE_LINE_TYPES = ["ITEM", "SERVICE", "FREE_TEXT"] as const;

function invoiceStatusForCriteria(criteria: string): Prisma.InvoiceWhereInput["status"] {
  switch (criteria) {
    case "INVOICES_VALIDATED":
      return { equals: "VALIDATED" };
    case "INVOICES_PAID":
      return { equals: "PAID" };
    case "INVOICES_UNPAID":
      return { in: ["VALIDATED", "SENT", "OVERDUE", "PARTIALLY_PAID"] as InvoiceStatus[] };
    default:
      return { notIn: ["DRAFT", "CANCELLED"] as InvoiceStatus[] };
  }
}

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  };
}

function safeDiv(total: number, qty: number): number {
  if (!qty) return 0;
  return Math.round((total / qty) * 100) / 100;
}

function scopeFromCriteria(criteria: string): SalesDocType[] {
  switch (criteria) {
    case "QUOTES":
      return ["QUOTE"];
    case "CREDIT_NOTES":
      return ["CREDIT_NOTE"];
    case "ALL":
      return ["INVOICE", "QUOTE", "CREDIT_NOTE"];
    default:
      return ["INVOICE"];
  }
}

async function fetchInvoiceRows(
  organizationId: string,
  filters: SalesDetailFilters,
): Promise<SalesDetailRow[]> {
  const dateFilter = dateRange(filters.from, filters.to);
  const lines = await prisma.invoiceLine.findMany({
    where: {
      organizationId,
      lineType: { in: [...BILLABLE_LINE_TYPES] },
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      invoice: {
        organizationId,
        isArchived: false,
        status: invoiceStatusForCriteria(filters.criteria ?? "INVOICES"),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.representativeId ? { createdById: filters.representativeId } : {}),
        ...(dateFilter ? { issueDate: dateFilter } : {}),
      },
    },
    select: {
      id: true,
      position: true,
      itemId: true,
      reference: true,
      name: true,
      description: true,
      quantity: true,
      unitPriceExcludingTax: true,
      vatRate: true,
      totalExcludingTax: true,
      totalVatAmount: true,
      totalIncludingTax: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          issueDate: true,
          customer: { select: { id: true, name: true, legalName: true, displayName: true } },
          billingAddress: { select: { country: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
    orderBy: { invoice: { issueDate: "desc" } },
    take: ROW_CAP,
  });

  return lines.map((l) => {
    const qty = moneyToNumber(l.quantity);
    const totalHt = moneyToNumber(l.totalExcludingTax);
    const vat = moneyToNumber(l.vatRate);
    const netHt = safeDiv(totalHt, qty);
    return {
      id: l.id,
      docType: "INVOICE" as const,
      docId: l.invoice.id,
      docNumber: l.invoice.invoiceNumber,
      docStatus: l.invoice.status,
      docDate: l.invoice.issueDate.toISOString(),
      position: l.position,
      itemId: l.itemId,
      reference: l.reference,
      name: l.name,
      description: l.description,
      customerId: l.invoice.customer?.id ?? null,
      customerName: l.invoice.customer?.name ?? "—",
      customerCompany: l.invoice.customer?.legalName ?? l.invoice.customer?.displayName ?? null,
      country: l.invoice.billingAddress?.country ?? null,
      quantity: qty,
      unitPriceGrossHt: moneyToNumber(l.unitPriceExcludingTax),
      unitPriceNetHt: netHt,
      unitPriceTtc: Math.round(netHt * (1 + vat / 100) * 100) / 100,
      totalExcludingTax: totalHt,
      totalVatAmount: moneyToNumber(l.totalVatAmount),
      totalIncludingTax: moneyToNumber(l.totalIncludingTax),
      vatRate: vat,
      representativeName: l.invoice.createdBy?.name ?? null,
    };
  });
}

async function fetchQuoteRows(
  organizationId: string,
  filters: SalesDetailFilters,
): Promise<SalesDetailRow[]> {
  const dateFilter = dateRange(filters.from, filters.to);
  const lines = await prisma.quoteLine.findMany({
    where: {
      organizationId,
      lineType: { in: [...BILLABLE_LINE_TYPES] },
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      quote: {
        organizationId,
        status: { notIn: ["DRAFT"] },
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(dateFilter ? { issueDate: dateFilter } : {}),
      },
    },
    select: {
      id: true,
      position: true,
      itemId: true,
      reference: true,
      name: true,
      description: true,
      quantity: true,
      unitPriceExcludingTax: true,
      vatRate: true,
      totalExcludingTax: true,
      totalVatAmount: true,
      totalIncludingTax: true,
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          issueDate: true,
          customer: { select: { id: true, name: true, legalName: true, displayName: true } },
          billingAddress: { select: { country: true } },
        },
      },
    },
    orderBy: { quote: { issueDate: "desc" } },
    take: ROW_CAP,
  });

  return lines.map((l) => {
    const qty = moneyToNumber(l.quantity);
    const totalHt = moneyToNumber(l.totalExcludingTax);
    const vat = moneyToNumber(l.vatRate);
    const netHt = safeDiv(totalHt, qty);
    return {
      id: l.id,
      docType: "QUOTE" as const,
      docId: l.quote.id,
      docNumber: l.quote.quoteNumber,
      docStatus: l.quote.status,
      docDate: l.quote.issueDate.toISOString(),
      position: l.position,
      itemId: l.itemId,
      reference: l.reference,
      name: l.name,
      description: l.description,
      customerId: l.quote.customer?.id ?? null,
      customerName: l.quote.customer?.name ?? "—",
      customerCompany: l.quote.customer?.legalName ?? l.quote.customer?.displayName ?? null,
      country: l.quote.billingAddress?.country ?? null,
      quantity: qty,
      unitPriceGrossHt: moneyToNumber(l.unitPriceExcludingTax),
      unitPriceNetHt: netHt,
      unitPriceTtc: Math.round(netHt * (1 + vat / 100) * 100) / 100,
      totalExcludingTax: totalHt,
      totalVatAmount: moneyToNumber(l.totalVatAmount),
      totalIncludingTax: moneyToNumber(l.totalIncludingTax),
      vatRate: vat,
      representativeName: null,
    };
  });
}

async function fetchCreditNoteRows(
  organizationId: string,
  filters: SalesDetailFilters,
): Promise<SalesDetailRow[]> {
  // Les avoirs n'ont pas d'article: exclus si filtre article actif.
  if (filters.itemId) return [];
  const dateFilter = dateRange(filters.from, filters.to);
  const lines = await prisma.creditNoteLine.findMany({
    where: {
      organizationId,
      creditNote: {
        organizationId,
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.representativeId ? { createdById: filters.representativeId } : {}),
        ...(dateFilter ? { issueDate: dateFilter } : {}),
      },
    },
    select: {
      id: true,
      position: true,
      name: true,
      description: true,
      quantity: true,
      unitPriceExcludingTax: true,
      vatRate: true,
      totalExcludingTax: true,
      totalVatAmount: true,
      totalIncludingTax: true,
      creditNote: {
        select: {
          id: true,
          creditNoteNumber: true,
          status: true,
          issueDate: true,
          customer: { select: { id: true, name: true, legalName: true, displayName: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
    orderBy: { creditNote: { issueDate: "desc" } },
    take: ROW_CAP,
  });

  return lines.map((l) => {
    const qty = moneyToNumber(l.quantity);
    const totalHt = moneyToNumber(l.totalExcludingTax);
    const vat = moneyToNumber(l.vatRate);
    const netHt = safeDiv(totalHt, qty);
    return {
      id: l.id,
      docType: "CREDIT_NOTE" as const,
      docId: l.creditNote.id,
      docNumber: l.creditNote.creditNoteNumber,
      docStatus: l.creditNote.status,
      docDate: l.creditNote.issueDate.toISOString(),
      position: l.position,
      itemId: null,
      reference: null,
      name: l.name,
      description: l.description,
      customerId: l.creditNote.customer?.id ?? null,
      customerName: l.creditNote.customer?.name ?? "—",
      customerCompany:
        l.creditNote.customer?.legalName ?? l.creditNote.customer?.displayName ?? null,
      country: null,
      quantity: qty,
      unitPriceGrossHt: moneyToNumber(l.unitPriceExcludingTax),
      unitPriceNetHt: netHt,
      unitPriceTtc: Math.round(netHt * (1 + vat / 100) * 100) / 100,
      totalExcludingTax: totalHt,
      totalVatAmount: moneyToNumber(l.totalVatAmount),
      totalIncludingTax: moneyToNumber(l.totalIncludingTax),
      vatRate: vat,
      representativeName: l.creditNote.createdBy?.name ?? null,
    };
  });
}

function computeTotals(rows: SalesDetailRow[]): SalesDetailTotals {
  const docs = new Set<string>();
  const customers = new Set<string>();
  const items = new Set<string>();
  let qty = 0;
  let ht = 0;
  let vat = 0;
  let ttc = 0;
  for (const r of rows) {
    docs.add(`${r.docType}:${r.docId}`);
    if (r.customerId) customers.add(r.customerId);
    if (r.itemId) items.add(r.itemId);
    qty += r.quantity;
    ht += r.totalExcludingTax;
    vat += r.totalVatAmount;
    ttc += r.totalIncludingTax;
  }
  return {
    lineCount: rows.length,
    totalQuantity: Math.round(qty * 100) / 100,
    totalExcludingTax: Math.round(ht * 100) / 100,
    totalVatAmount: Math.round(vat * 100) / 100,
    totalIncludingTax: Math.round(ttc * 100) / 100,
    distinctDocuments: docs.size,
    distinctCustomers: customers.size,
    distinctItems: items.size,
  };
}

async function getRepresentatives(organizationId: string) {
  const rows = await prisma.invoice.findMany({
    where: { organizationId, createdById: { not: null } },
    select: { createdBy: { select: { id: true, name: true } } },
    distinct: ["createdById"],
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.createdBy) map.set(r.createdBy.id, r.createdBy.name);
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

/** Récupère l'ensemble des lignes filtrées (plafonné à ROW_CAP), triées par date desc. */
export async function gatherSalesDetailRows(
  organizationId: string,
  filters: SalesDetailFilters,
): Promise<SalesDetailRow[]> {
  const scope = scopeFromCriteria(filters.criteria ?? "INVOICES");
  const parts: SalesDetailRow[] = [];
  if (scope.includes("INVOICE")) parts.push(...(await fetchInvoiceRows(organizationId, filters)));
  if (scope.includes("QUOTE")) parts.push(...(await fetchQuoteRows(organizationId, filters)));
  if (scope.includes("CREDIT_NOTE"))
    parts.push(...(await fetchCreditNoteRows(organizationId, filters)));
  parts.sort((a, b) => (a.docDate < b.docDate ? 1 : a.docDate > b.docDate ? -1 : 0));
  return parts;
}

export async function listSalesDetailQuery(
  organizationId: string,
  filters: SalesDetailFilters,
): Promise<SalesDetailResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));

  const parts = await gatherSalesDetailRows(organizationId, filters);

  const totals = computeTotals(parts);
  const total = parts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = parts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const representatives = await getRepresentatives(organizationId);

  const year = new Date().getFullYear();
  return {
    rows,
    totals,
    total,
    page: safePage,
    pageSize,
    totalPages,
    exercise: {
      from: filters.from ?? `${year}-01-01`,
      to: filters.to ?? `${year}-12-31`,
    },
    representatives,
    capped: total >= ROW_CAP,
  };
}

const DOC_TYPE_LABELS: Record<SalesDocType, string> = {
  INVOICE: "Facture",
  QUOTE: "Devis",
  CREDIT_NOTE: "Avoir",
};

export function buildSalesDetailCsv(rows: SalesDetailRow[]): string {
  const header = [
    "Type pièce",
    "N° pièce",
    "Indice",
    "Article",
    "Description",
    "Client",
    "Société",
    "Date pièce",
    "Prix Unit. HT rem.",
    "Qté",
    "Mt Total HT",
    "Prix Unit. Brut",
    "Prix Unit. Net",
    "Prix Unit. TTC",
    "Code TVA",
    "Pays",
  ].join(";");

  const lines = rows.map((r) =>
    [
      DOC_TYPE_LABELS[r.docType],
      r.docNumber,
      r.position + 1,
      r.reference ?? r.name,
      (r.description ?? "").replace(/[\n;]/g, " "),
      r.customerName,
      r.customerCompany ?? "",
      new Date(r.docDate).toLocaleDateString("fr-FR"),
      r.unitPriceNetHt.toFixed(2),
      r.quantity,
      r.totalExcludingTax.toFixed(2),
      r.unitPriceGrossHt.toFixed(2),
      r.unitPriceNetHt.toFixed(2),
      r.unitPriceTtc.toFixed(2),
      `${r.vatRate}%`,
      r.country ?? "",
    ].join(";"),
  );

  return [header, ...lines].join("\n");
}
