import type { SearchEntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moneyToNumber } from "@/lib/money";
import { STATIC_SETTINGS_ENTRIES } from "@/lib/search/search-registry";
import { getQuickActions } from "@/lib/search/quick-actions";
import { applyRanking, sortSearchResults } from "@/lib/search/search-ranking";
import { canSearchEntityType } from "@/lib/search/search-permissions";
import type {
  GlobalSearchOptions,
  GlobalSearchResponse,
  SearchResult,
  SearchResultGroup,
} from "@/lib/search/search-types";
import { SEARCH_GROUP_LABELS, SEARCH_GROUP_ORDER } from "@/lib/search/search-registry";
import { buildPrismaContains, favoriteKey, normalizeSearchQuery } from "@/lib/search/search-utils";
import {
  formatSearchAmount,
  formatSearchDate,
  invoiceStatusLabel,
  quoteStatusLabel,
  supplierInvoiceStatusLabel,
} from "@/lib/search/search-formatters";
import type { SessionUser } from "@/lib/permissions";
import { getCachedEnabledModules } from "@/lib/org-cache";

const DEFAULT_LIMIT_PER_GROUP = 5;
const DEFAULT_GLOBAL_LIMIT = 50;

export async function loadEnabledModules(organizationId: string): Promise<Set<string>> {
  return getCachedEnabledModules(organizationId);
}

export async function loadFavoriteKeys(
  organizationId: string,
  userId: string,
): Promise<Set<string>> {
  const favorites = await prisma.favoriteEntity.findMany({
    where: { organizationId, userId },
  });
  return new Set(favorites.map((f) => favoriteKey(f.entityType, f.entityId)));
}

function containsFilter(q: string) {
  const term = buildPrismaContains(q);
  return { contains: term };
}

export async function searchCustomers(
  organizationId: string,
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.customer.findMany({
    where: {
      organizationId,
      OR: [
        { customerNumber: q },
        { name: q },
        { legalName: q },
        { displayName: q },
        { email: q },
        { phone: q },
        { siret: q },
        { vatNumber: q },
        { notes: q },
        { contacts: { some: { OR: [{ mobile: q }, { phone: q }] } } },
        { tagAssignments: { some: { tag: { name: q } } } },
        { addresses: { some: { city: q } } },
      ],
    },
    include: { addresses: { where: { isDefault: true }, take: 1 } },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((c) => {
    const city = c.addresses[0]?.city;
    return {
      id: c.id,
      type: "CUSTOMER" as const,
      title: c.displayName ?? c.name,
      subtitle: `Client · ${c.customerNumber}${city ? ` · ${city}` : ""}`,
      href: `/customers/${c.id}`,
      badge: c.isArchived ? "Archivé" : undefined,
      badgeVariant: c.isArchived ? "secondary" : undefined,
      score: 0,
      metadata: { numberField: "customerNumber", numberValue: c.customerNumber },
    };
  });
}

export async function searchItems(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.item.findMany({
    where: {
      organizationId,
      OR: [
        { itemNumber: q },
        { sku: q },
        { name: q },
        { description: q },
        { shortDescription: q },
        { barcode: q },
        { category: { name: q } },
        { tagAssignments: { some: { tag: { name: q } } } },
        { supplier: { name: q } },
      ],
    },
    include: { category: { select: { name: true } } },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((item) => ({
    id: item.id,
    type: "ITEM" as const,
    title: item.name,
    subtitle: `Article · ${item.itemNumber}${item.category ? ` · ${item.category.name}` : ""}`,
    href: `/items/${item.id}`,
    amount: moneyToNumber(item.salePriceExcludingTax),
    currency: item.currency,
    badge: item.isArchived ? "Archivé" : item.status,
    score: 0,
    metadata: { numberField: "itemNumber", numberValue: item.itemNumber },
  }));
}

export async function searchQuotes(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.quote.findMany({
    where: {
      organizationId,
      OR: [
        { quoteNumber: q },
        { title: q },
        { subject: q },
        { internalNotes: q },
        { customer: { name: q } },
      ],
    },
    include: { customer: { select: { name: true } } },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "QUOTE" as const,
    title: row.quoteNumber,
    subtitle: `Devis · ${row.customer.name} · ${quoteStatusLabel(row.status)}`,
    href: `/quotes/${row.id}`,
    amount: moneyToNumber(row.totalIncludingTax),
    currency: row.currency,
    date: row.issueDate,
    status: row.status,
    score: 0,
    metadata: { numberField: "quoteNumber", numberValue: row.quoteNumber },
  }));
}

export async function searchInvoices(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.invoice.findMany({
    where: {
      organizationId,
      OR: [
        { invoiceNumber: q },
        { title: q },
        { subject: q },
        { internalNotes: q },
        { customer: { name: q } },
        { customer: { email: q } },
        { customer: { siret: q } },
        { customer: { phone: q } },
        { lines: { some: { OR: [{ reference: q }, { name: q }] } } },
      ],
    },
    include: { customer: { select: { name: true } } },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "INVOICE" as const,
    title: row.invoiceNumber,
    subtitle: `Facture · ${row.customer.name} · ${formatSearchAmount(row.totalIncludingTax, row.currency)} · ${invoiceStatusLabel(row.status, row.paymentStatus)}`,
    href: `/invoices/${row.id}`,
    amount: moneyToNumber(row.totalIncludingTax),
    currency: row.currency,
    date: row.dueDate,
    status: row.paymentStatus,
    badge: row.paymentStatus === "OVERDUE" ? "En retard" : undefined,
    badgeVariant: row.paymentStatus === "OVERDUE" ? "warning" : undefined,
    score: 0,
    metadata: { numberField: "invoiceNumber", numberValue: row.invoiceNumber },
  }));
}

export async function searchPayments(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.payment.findMany({
    where: {
      organizationId,
      OR: [
        { paymentNumber: q },
        { reference: q },
        { bankReference: q },
        { checkNumber: q },
        { notes: q },
        { customer: { name: q } },
        { customer: { email: q } },
        { allocations: { some: { invoice: { invoiceNumber: q } } } },
      ],
    },
    include: { customer: { select: { name: true } } },
    take: limit,
    orderBy: { paymentDate: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "PAYMENT" as const,
    title: row.paymentNumber,
    subtitle: `Paiement · ${row.customer.name} · ${row.method} · ${formatSearchAmount(row.amount, row.currency)}`,
    href: `/payments/${row.id}`,
    amount: moneyToNumber(row.amount),
    currency: row.currency,
    date: row.paymentDate,
    score: 0,
    metadata: { numberField: "paymentNumber", numberValue: row.paymentNumber },
  }));
}

export async function searchReminders(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.reminder.findMany({
    where: {
      organizationId,
      OR: [
        { reminderNumber: q },
        { subject: q },
        { message: q },
        { recipientEmail: q },
        { customer: { name: q } },
        { invoice: { invoiceNumber: q } },
      ],
    },
    include: {
      customer: { select: { name: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "REMINDER" as const,
    title: row.reminderNumber,
    subtitle: `Relance · ${row.customer.name} · ${row.invoice.invoiceNumber} · Niveau ${row.level}`,
    href: `/reminders/${row.id}`,
    date: row.dueDate,
    score: 0,
    metadata: { numberField: "reminderNumber", numberValue: row.reminderNumber },
  }));
}

export async function searchSuppliers(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.supplier.findMany({
    where: {
      organizationId,
      OR: [
        { supplierNumber: q },
        { name: q },
        { legalName: q },
        { email: q },
        { phone: q },
        { siret: q },
        { vatNumber: q },
        { addresses: { some: { city: q } } },
      ],
    },
    include: { addresses: { where: { isDefault: true }, take: 1 } },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((s) => {
    const city = s.addresses[0]?.city;
    return {
      id: s.id,
      type: "SUPPLIER" as const,
      title: s.displayName ?? s.name,
      subtitle: `Fournisseur · ${s.supplierNumber}${city ? ` · ${city}` : ""}`,
      href: `/suppliers/${s.id}`,
      badge: s.isArchived ? "Archivé" : undefined,
      score: 0,
      metadata: { numberField: "supplierNumber", numberValue: s.supplierNumber },
    };
  });
}

export async function searchSupplierInvoices(
  organizationId: string,
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.supplierInvoice.findMany({
    where: {
      organizationId,
      OR: [
        { supplierInvoiceNumber: q },
        { supplierReference: q },
        { title: q },
        { description: q },
        { supplier: { name: q } },
      ],
    },
    include: { supplier: { select: { name: true } } },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "SUPPLIER_INVOICE" as const,
    title: row.supplierInvoiceNumber,
    subtitle: `Facture fournisseur · ${row.supplier.name} · ${supplierInvoiceStatusLabel(row.status)}`,
    href: `/supplier-invoices/${row.id}`,
    amount: moneyToNumber(row.totalIncludingTax),
    currency: row.currency,
    date: row.dueDate,
    score: 0,
    metadata: { numberField: "supplierInvoiceNumber", numberValue: row.supplierInvoiceNumber },
  }));
}

export async function searchAccountingEntries(
  organizationId: string,
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.accountingEntry.findMany({
    where: {
      organizationId,
      OR: [
        { entryNumber: q },
        { label: q },
        { reference: q },
        { sourceLabel: q },
        { journal: { code: q } },
        { journal: { name: q } },
      ],
    },
    include: { journal: { select: { code: true, name: true } } },
    take: limit,
    orderBy: { entryDate: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "ACCOUNTING_ENTRY" as const,
    title: row.entryNumber,
    subtitle: `Écriture · ${row.journal.code} — ${row.journal.name} · ${row.status}`,
    href: `/accounting/entries/${row.id}`,
    date: row.entryDate,
    score: 0,
    metadata: { numberField: "entryNumber", numberValue: row.entryNumber },
  }));
}

export async function searchDocuments(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.document.findMany({
    where: {
      organizationId,
      OR: [{ title: q }, { fileName: q }, { description: q }, { entityType: q }],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "DOCUMENT" as const,
    title: row.title,
    subtitle: `Document · ${row.fileName} · ${row.mimeType}`,
    href: `/documents/${row.id}`,
    date: row.createdAt,
    score: 0,
  }));
}

export async function searchExports(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.exportJob.findMany({
    where: {
      organizationId,
      OR: [{ fileName: q }, { errorMessage: q }],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "EXPORT_JOB" as const,
    title: row.fileName ?? `Export ${row.type}`,
    subtitle: `Export · ${row.type} · ${row.format} · ${row.status}`,
    href: `/exports/history/${row.id}`,
    date: row.createdAt,
    score: 0,
  }));
}

export function searchSettings(query: string, limit = 5): SearchResult[] {
  const q = normalizeSearchQuery(query);
  if (!q) return [];
  return STATIC_SETTINGS_ENTRIES.filter(
    (s) =>
      normalizeSearchQuery(s.title).includes(q) ||
      s.keywords.some((k) => normalizeSearchQuery(k).includes(q) || q.includes(normalizeSearchQuery(k))),
  )
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      type: "SETTING" as const,
      title: s.title,
      subtitle: "Paramètres",
      href: s.href,
      score: 0,
    }));
}

export async function searchAuditLogs(
  organizationId: string,
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const q = containsFilter(query);
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      OR: [{ entityType: q }, { entityLabel: q }],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: "AUDIT_LOG" as const,
    title: row.entityLabel ?? row.action,
    subtitle: `Audit · ${row.action} · ${formatSearchDate(row.createdAt)}`,
    href: "/settings/audit-log",
    date: row.createdAt,
    score: 0,
  }));
}

export async function searchByType(
  type: SearchEntityType,
  organizationId: string,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  switch (type) {
    case "CUSTOMER":
      return searchCustomers(organizationId, query, limit);
    case "ITEM":
      return searchItems(organizationId, query, limit);
    case "QUOTE":
      return searchQuotes(organizationId, query, limit);
    case "INVOICE":
      return searchInvoices(organizationId, query, limit);
    case "PAYMENT":
      return searchPayments(organizationId, query, limit);
    case "REMINDER":
      return searchReminders(organizationId, query, limit);
    case "SUPPLIER":
      return searchSuppliers(organizationId, query, limit);
    case "SUPPLIER_INVOICE":
      return searchSupplierInvoices(organizationId, query, limit);
    case "ACCOUNTING_ENTRY":
      return searchAccountingEntries(organizationId, query, limit);
    case "DOCUMENT":
      return searchDocuments(organizationId, query, limit);
    case "EXPORT_JOB":
      return searchExports(organizationId, query, limit);
    case "SETTING":
      return searchSettings(query, limit);
    case "AUDIT_LOG":
      return searchAuditLogs(organizationId, query, limit);
    default:
      return [];
  }
}

export function groupSearchResults(
  results: SearchResult[],
  limitPerGroup = DEFAULT_LIMIT_PER_GROUP,
): SearchResultGroup[] {
  const byType = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = byType.get(r.type) ?? [];
    list.push(r);
    byType.set(r.type, list);
  }

  const groups: SearchResultGroup[] = [];
  for (const type of SEARCH_GROUP_ORDER) {
    if (type === "ACTION") continue;
    const list = byType.get(type);
    if (!list?.length) continue;
    groups.push({
      type: type as SearchEntityType,
      label: SEARCH_GROUP_LABELS[type] ?? type,
      results: list.slice(0, limitPerGroup),
    });
  }
  return groups;
}

export function quickActionsToResults(
  actions: ReturnType<typeof getQuickActions>,
): SearchResult[] {
  return actions.map((a) => ({
    id: a.id,
    type: "ACTION" as const,
    title: a.label,
    subtitle: a.description ?? "Action rapide",
    href: a.href,
    score: 50,
    metadata: { icon: a.icon },
  }));
}

export async function globalSearch(
  user: SessionUser,
  query: string,
  options?: Partial<GlobalSearchOptions>,
): Promise<GlobalSearchResponse> {
  const organizationId = options?.organizationId ?? user.organizationId;
  const enabledModules = options?.enabledModules ?? (await loadEnabledModules(organizationId));
  const favoriteKeys = options?.favoriteKeys ?? (await loadFavoriteKeys(organizationId, user.id));
  const limitPerGroup = options?.limitPerGroup ?? DEFAULT_LIMIT_PER_GROUP;
  const globalLimit = options?.globalLimit ?? DEFAULT_GLOBAL_LIMIT;
  const normalized = normalizeSearchQuery(query);

  const quickActions = getQuickActions(user, enabledModules, query);
  const actionResults = quickActionsToResults(quickActions);

  if (!normalized) {
    return {
      query: "",
      groups: [
        { type: "ACTION", label: SEARCH_GROUP_LABELS.ACTION, results: actionResults.slice(0, limitPerGroup) },
      ],
      totalCount: actionResults.length,
    };
  }

  const typesToSearch: SearchEntityType[] = [
    "CUSTOMER",
    "ITEM",
    "QUOTE",
    "INVOICE",
    "PAYMENT",
    "REMINDER",
    "SUPPLIER",
    "SUPPLIER_INVOICE",
    "ACCOUNTING_ENTRY",
    "DOCUMENT",
    "EXPORT_JOB",
    "SETTING",
    "AUDIT_LOG",
  ];

  const allResults: SearchResult[] = [...actionResults];
  const term = buildPrismaContains(query);
  const searchTasks: Promise<void>[] = [];

  for (const type of typesToSearch) {
    if (!canSearchEntityType(user, type, enabledModules)) continue;
    searchTasks.push(
      searchByType(type, organizationId, term, limitPerGroup).then((rows) => {
        allResults.push(...rows);
      }),
    );
  }

  await Promise.all(searchTasks);

  const ranked = applyRanking(allResults, query, favoriteKeys).slice(0, globalLimit);
  const groups: SearchResultGroup[] = [];

  const actionGroup = ranked.filter((r) => r.type === "ACTION").slice(0, limitPerGroup);
  if (actionGroup.length) {
    groups.push({ type: "ACTION", label: SEARCH_GROUP_LABELS.ACTION, results: actionGroup });
  }

  const entityResults = ranked.filter((r) => r.type !== "ACTION");
  groups.push(...groupSearchResults(entityResults, limitPerGroup));

  return {
    query,
    groups,
    totalCount: ranked.length,
  };
}

