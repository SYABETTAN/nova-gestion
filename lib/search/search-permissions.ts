import type { PermissionKey } from "@prisma/client";
import type { SearchEntityType } from "@prisma/client";
import type { SessionUser } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

const ENTITY_READ_PERMISSION: Partial<Record<SearchEntityType, PermissionKey>> = {
  CUSTOMER: "CUSTOMERS_READ",
  ITEM: "ITEMS_READ",
  QUOTE: "QUOTES_READ",
  INVOICE: "INVOICES_READ",
  PAYMENT: "PAYMENTS_READ",
  REMINDER: "REMINDERS_READ",
  SUPPLIER: "SUPPLIERS_READ",
  SUPPLIER_INVOICE: "SUPPLIER_INVOICES_READ",
  ACCOUNTING_ENTRY: "ACCOUNTING_READ",
  DOCUMENT: "DOCUMENTS_READ",
  EXPORT_JOB: "EXPORTS_READ",
  SETTING: "ADVANCED_SETTINGS_READ",
  AUDIT_LOG: "AUDIT_LOG_READ",
};

const ENTITY_MODULE_KEY: Partial<Record<SearchEntityType, string>> = {
  CUSTOMER: "customers",
  ITEM: "items",
  QUOTE: "quotes",
  INVOICE: "invoices",
  PAYMENT: "payments",
  REMINDER: "reminders",
  SUPPLIER: "suppliers",
  SUPPLIER_INVOICE: "supplierInvoices",
  ACCOUNTING_ENTRY: "accounting",
  DOCUMENT: "documents",
  EXPORT_JOB: "exports",
};

export function canSearchEntityType(
  user: Pick<SessionUser, "permissions">,
  type: SearchEntityType,
  enabledModules: Set<string>,
): boolean {
  const perm = ENTITY_READ_PERMISSION[type];
  if (perm && !hasPermission(user, perm)) return false;
  const moduleKey = ENTITY_MODULE_KEY[type];
  if (moduleKey && !enabledModules.has(moduleKey)) return false;
  return true;
}

export function filterSearchTypes(
  user: Pick<SessionUser, "permissions">,
  types: SearchEntityType[],
  enabledModules: Set<string>,
): SearchEntityType[] {
  return types.filter((t) => canSearchEntityType(user, t, enabledModules));
}
