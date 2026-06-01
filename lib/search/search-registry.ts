import type { SearchEntityType } from "@prisma/client";

export const SEARCH_GROUP_LABELS: Record<string, string> = {
  ACTION: "Actions rapides",
  CUSTOMER: "Clients",
  ITEM: "Articles & services",
  QUOTE: "Devis",
  INVOICE: "Factures",
  PAYMENT: "Paiements",
  REMINDER: "Relances",
  SUPPLIER: "Fournisseurs",
  SUPPLIER_INVOICE: "Factures fournisseurs",
  ACCOUNTING_ENTRY: "Comptabilité",
  DOCUMENT: "Documents",
  EXPORT_JOB: "Exports",
  SETTING: "Paramètres",
  AUDIT_LOG: "Journal d'audit",
};

export const SEARCH_GROUP_ORDER: (SearchEntityType | "ACTION")[] = [
  "ACTION",
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

export type StaticSettingEntry = {
  id: string;
  title: string;
  keywords: string[];
  href: string;
};

export const STATIC_SETTINGS_ENTRIES: StaticSettingEntry[] = [
  { id: "taxes", title: "TVA et taxes", keywords: ["tva", "taxes", "fiscal"], href: "/settings/taxes" },
  { id: "payment-terms", title: "Conditions de paiement", keywords: ["paiement", "délai", "échéance"], href: "/settings/payment-terms" },
  { id: "currencies", title: "Devises", keywords: ["devise", "eur", "usd"], href: "/settings/currencies" },
  { id: "localization", title: "Localisation", keywords: ["langue", "fuseau", "format"], href: "/settings/localization" },
  { id: "commercial", title: "Préférences commerciales", keywords: ["devis", "commercial"], href: "/settings/commercial" },
  { id: "invoicing", title: "Préférences facturation", keywords: ["facture", "facturation"], href: "/settings/invoicing" },
  { id: "suppliers-pref", title: "Préférences fournisseurs", keywords: ["fournisseur", "dépense"], href: "/settings/suppliers" },
  { id: "accounting", title: "Préférences comptables", keywords: ["comptabilité", "journal"], href: "/settings/accounting" },
  { id: "mapping", title: "Mapping comptable", keywords: ["mapping", "compte"], href: "/settings/accounting-mapping" },
  { id: "notifications", title: "Notifications", keywords: ["notification", "email"], href: "/settings/notifications" },
  { id: "features", title: "Modules", keywords: ["feature", "flag", "module"], href: "/settings/features" },
  { id: "custom-fields", title: "Champs personnalisés", keywords: ["champ", "personnalisé"], href: "/settings/custom-fields" },
  { id: "maintenance", title: "Maintenance système", keywords: ["maintenance", "système"], href: "/settings" },
  { id: "settings-hub", title: "Centre de configuration", keywords: ["paramètres", "configuration"], href: "/settings" },
  { id: "company", title: "Paramètres entreprise", keywords: ["entreprise", "société"], href: "/settings/company" },
  { id: "audit", title: "Journal d'audit", keywords: ["audit", "historique"], href: "/settings/audit-log" },
];
