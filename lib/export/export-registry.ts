import type { ExportDefinition } from "@/lib/export/export-types";
import type { ExportType } from "@prisma/client";

export const EXPORT_DEFINITIONS: ExportDefinition[] = [
  {
    type: "CUSTOMERS",
    label: "Clients",
    description: "Liste des clients avec encours et coordonnées",
    section: "commercial",
    formats: ["CSV", "JSON"],
    permission: "CUSTOMERS_READ",
    supportsJson: true,
  },
  {
    type: "ITEMS",
    label: "Articles & services",
    description: "Catalogue produits et services",
    section: "commercial",
    formats: ["CSV"],
    permission: "ITEMS_READ",
  },
  {
    type: "QUOTES",
    label: "Devis",
    description: "Devis commerciaux et montants",
    section: "commercial",
    formats: ["CSV", "JSON"],
    permission: "QUOTES_READ",
    supportsJson: true,
    supportsPeriod: true,
  },
  {
    type: "INVOICES",
    label: "Factures clients",
    description: "Factures émises et statuts de paiement",
    section: "commercial",
    formats: ["CSV", "JSON"],
    permission: "INVOICES_READ",
    supportsJson: true,
    supportsPeriod: true,
  },
  {
    type: "PAYMENTS",
    label: "Paiements clients",
    description: "Encaissements et allocations",
    section: "commercial",
    formats: ["CSV", "JSON"],
    permission: "PAYMENTS_READ",
    supportsJson: true,
    supportsPeriod: true,
  },
  {
    type: "REMINDERS",
    label: "Relances clients",
    description: "Factures à relancer et historique",
    section: "commercial",
    formats: ["CSV"],
    permission: "REMINDERS_READ",
    supportsPeriod: true,
  },
  {
    type: "SUPPLIERS",
    label: "Fournisseurs",
    description: "Fournisseurs et risques",
    section: "suppliers",
    formats: ["CSV"],
    permission: "SUPPLIERS_READ",
  },
  {
    type: "SUPPLIER_INVOICES",
    label: "Factures fournisseurs",
    description: "Dépenses et échéances fournisseurs",
    section: "suppliers",
    formats: ["CSV"],
    permission: "SUPPLIER_INVOICES_READ",
    supportsPeriod: true,
  },
  {
    type: "ACCOUNTING_ACCOUNTS",
    label: "Plan comptable",
    description: "Comptes du plan comptable",
    section: "accounting",
    formats: ["CSV"],
    permission: "ACCOUNTING_EXPORT",
  },
  {
    type: "ACCOUNTING_JOURNALS",
    label: "Journaux comptables",
    description: "Journaux de saisie",
    section: "accounting",
    formats: ["CSV"],
    permission: "ACCOUNTING_EXPORT",
  },
  {
    type: "ACCOUNTING_ENTRIES",
    label: "Écritures comptables",
    description: "Écritures et statuts",
    section: "accounting",
    formats: ["CSV", "JSON"],
    permission: "ACCOUNTING_EXPORT",
    supportsJson: true,
    supportsPeriod: true,
  },
  {
    type: "ACCOUNTING_ENTRY_LINES",
    label: "Lignes d'écritures",
    description: "Détail des lignes comptables",
    section: "accounting",
    formats: ["CSV"],
    permission: "ACCOUNTING_EXPORT",
    supportsPeriod: true,
  },
  {
    type: "GENERAL_LEDGER",
    label: "Grand livre",
    description: "Mouvements par compte",
    section: "accounting",
    formats: ["CSV"],
    permission: "ACCOUNTING_EXPORT",
    supportsPeriod: true,
  },
  {
    type: "TRIAL_BALANCE",
    label: "Balance",
    description: "Balance générale indicative",
    section: "accounting",
    formats: ["CSV"],
    permission: "ACCOUNTING_EXPORT",
    supportsPeriod: true,
  },
  {
    type: "VAT_SUMMARY",
    label: "TVA indicative",
    description: "Synthèse TVA collectée et déductible",
    section: "accounting",
    formats: ["CSV"],
    permission: "ACCOUNTING_EXPORT",
    supportsPeriod: true,
  },
  {
    type: "DASHBOARD_KPIS",
    label: "Indicateurs tableau de bord",
    description: "KPIs consolidés du pilotage",
    section: "pilotage",
    formats: ["CSV", "JSON"],
    permission: "DASHBOARD_EXPORT",
    supportsJson: true,
    supportsPeriod: true,
  },
  {
    type: "DOCUMENTS",
    label: "Bibliothèque documentaire",
    description: "Liste des documents",
    section: "pilotage",
    formats: ["CSV"],
    permission: "DOCUMENTS_READ",
  },
  {
    type: "AUDIT_LOGS",
    label: "Journal d'audit",
    description: "Historique des actions",
    section: "pilotage",
    formats: ["CSV"],
    permission: "AUDIT_LOG_READ",
    supportsPeriod: true,
  },
];

export function getExportDefinition(type: ExportType): ExportDefinition {
  const def = EXPORT_DEFINITIONS.find((d) => d.type === type);
  if (!def) throw new Error(`Type d'export inconnu : ${type}`);
  return def;
}

export function listAvailableExports(): ExportDefinition[] {
  return EXPORT_DEFINITIONS;
}

export const EXPORT_SECTION_LABELS: Record<ExportDefinition["section"], string> = {
  commercial: "Exports commerciaux",
  suppliers: "Exports fournisseurs",
  accounting: "Exports comptabilité légère",
  pilotage: "Exports pilotage",
  documents: "Documents imprimables",
};

export const DOCUMENT_EXPORT_LINKS: {
  label: string;
  description: string;
  href: string;
  section: "documents";
}[] = [
  { label: "Devis", description: "Impression depuis la fiche devis", href: "/quotes", section: "documents" },
  { label: "Factures clients", description: "Impression depuis la fiche facture", href: "/invoices", section: "documents" },
  { label: "Avoirs", description: "Impression depuis la fiche avoir", href: "/invoices", section: "documents" },
  { label: "Reçus de paiement", description: "Reçu de paiement", href: "/payments", section: "documents" },
  { label: "Relances", description: "Lettre de relance", href: "/reminders", section: "documents" },
  { label: "Factures fournisseurs", description: "Impression facture fournisseur", href: "/supplier-invoices", section: "documents" },
];
