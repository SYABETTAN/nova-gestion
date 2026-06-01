import type { DocumentType, NumberingSequenceType } from "@prisma/client";

/** Plan comptable minimal requis pour factures, paiements et écritures automatiques. */
export const BOOTSTRAP_ACCOUNTS = [
  { accountNumber: "101000", name: "Capital social", type: "EQUITY", category: "OTHER" },
  { accountNumber: "401000", name: "Fournisseurs", type: "SUPPLIER", category: "SUPPLIER_PAYABLE" },
  { accountNumber: "411000", name: "Clients", type: "CUSTOMER", category: "CUSTOMER_RECEIVABLE" },
  { accountNumber: "512000", name: "Banque", type: "BANK", category: "BANK" },
  { accountNumber: "530000", name: "Caisse", type: "ASSET", category: "CASH" },
  { accountNumber: "606300", name: "Fournitures", type: "EXPENSE", category: "PURCHASE_EXPENSE" },
  { accountNumber: "607000", name: "Achats de marchandises", type: "EXPENSE", category: "PURCHASE_EXPENSE" },
  { accountNumber: "611000", name: "Sous-traitance", type: "EXPENSE", category: "GENERAL_EXPENSE" },
  { accountNumber: "615000", name: "Maintenance", type: "EXPENSE", category: "GENERAL_EXPENSE" },
  { accountNumber: "622600", name: "Honoraires", type: "EXPENSE", category: "GENERAL_EXPENSE" },
  { accountNumber: "626000", name: "Télécommunications", type: "EXPENSE", category: "GENERAL_EXPENSE" },
  { accountNumber: "627000", name: "Frais bancaires", type: "EXPENSE", category: "GENERAL_EXPENSE" },
  { accountNumber: "706000", name: "Prestations de services", type: "REVENUE", category: "SERVICE_REVENUE" },
  { accountNumber: "707000", name: "Ventes de marchandises", type: "REVENUE", category: "SALES_REVENUE" },
  { accountNumber: "709000", name: "Remises accordées", type: "REVENUE", category: "DISCOUNT" },
  { accountNumber: "445660", name: "TVA déductible", type: "TAX", category: "VAT_DEDUCTIBLE" },
  { accountNumber: "445710", name: "TVA collectée", type: "TAX", category: "VAT_COLLECTED" },
  { accountNumber: "445510", name: "TVA à décaisser", type: "TAX", category: "VAT_DUE" },
  { accountNumber: "758000", name: "Produits divers", type: "REVENUE", category: "OTHER" },
  { accountNumber: "658000", name: "Charges diverses", type: "EXPENSE", category: "OTHER" },
] as const;

export const BOOTSTRAP_JOURNALS = [
  { code: "VE", name: "Journal des ventes", type: "SALES" },
  { code: "AC", name: "Journal des achats", type: "PURCHASES" },
  { code: "BQ", name: "Journal de banque", type: "BANK" },
  { code: "CA", name: "Journal de caisse", type: "CASH" },
  { code: "OD", name: "Opérations diverses", type: "MISCELLANEOUS" },
] as const;

export type BootstrapNumberingSequence = {
  type: NumberingSequenceType;
  prefix: string;
  nextNumber: number;
  padding: number;
  suffix: string;
  resetPeriod: "NEVER" | "YEARLY" | "MONTHLY";
};

/** Séquences de numérotation initiales (premier numéro = 1). */
export const BOOTSTRAP_NUMBERING_SEQUENCES: BootstrapNumberingSequence[] = [
  { type: "CUSTOMER", prefix: "CLI-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "NEVER" },
  { type: "SUPPLIER", prefix: "FOU-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "NEVER" },
  { type: "ITEM", prefix: "ART-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "NEVER" },
  { type: "QUOTE", prefix: "DEV-{YYYY}-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "YEARLY" },
  { type: "INVOICE", prefix: "FAC-{YYYY}-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "YEARLY" },
  { type: "CREDIT_NOTE", prefix: "AVO-{YYYY}-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "YEARLY" },
  { type: "PAYMENT", prefix: "REG-{YYYY}-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "YEARLY" },
  { type: "REMINDER", prefix: "REL-{YYYY}-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "YEARLY" },
  { type: "SUPPLIER_INVOICE", prefix: "ACH-{YYYY}-", nextNumber: 1, padding: 4, suffix: "", resetPeriod: "YEARLY" },
  { type: "ACCOUNTING_ENTRY", prefix: "ECR-{YYYY}-", nextNumber: 1, padding: 5, suffix: "", resetPeriod: "YEARLY" },
];

export const BOOTSTRAP_TAX_RATES = [
  { name: "TVA 20 %", rate: 20, isDefault: true },
  { name: "TVA 10 %", rate: 10, isDefault: false },
  { name: "TVA 5,5 %", rate: 5.5, isDefault: false },
  { name: "TVA 2,1 %", rate: 2.1, isDefault: false },
  { name: "Exonéré 0 %", rate: 0, type: "EXEMPT" as const, isDefault: false },
];

export const BOOTSTRAP_PAYMENT_TERMS = [
  { name: "Paiement comptant", days: 0, isDefault: false },
  { name: "15 jours", days: 15, isDefault: false },
  { name: "30 jours", days: 30, isDefault: true },
  { name: "45 jours", days: 45, isDefault: false },
  { name: "60 jours", days: 60, isDefault: false },
];

export const BOOTSTRAP_CURRENCIES = [
  { code: "EUR", name: "Euro", symbol: "€", exchangeRateToDefault: 1, isDefault: true },
  { code: "USD", name: "Dollar US", symbol: "$", exchangeRateToDefault: 1.08, isDefault: false },
  { code: "GBP", name: "Livre sterling", symbol: "£", exchangeRateToDefault: 0.86, isDefault: false },
  { code: "CHF", name: "Franc suisse", symbol: "CHF", exchangeRateToDefault: 0.95, isDefault: false },
];

export const BOOTSTRAP_ACCOUNTING_MAPPINGS: {
  type: string;
  label: string;
  accountNumber: string;
}[] = [
  { type: "CUSTOMER_RECEIVABLE", label: "Clients", accountNumber: "411000" },
  { type: "SUPPLIER_PAYABLE", label: "Fournisseurs", accountNumber: "401000" },
  { type: "BANK", label: "Banque", accountNumber: "512000" },
  { type: "CASH", label: "Caisse", accountNumber: "530000" },
  { type: "SALES_SERVICE", label: "Ventes services", accountNumber: "706000" },
  { type: "SALES_PRODUCT", label: "Ventes produits", accountNumber: "707000" },
  { type: "VAT_COLLECTED", label: "TVA collectée", accountNumber: "445710" },
  { type: "VAT_DEDUCTIBLE", label: "TVA déductible", accountNumber: "445660" },
  { type: "PURCHASE_EXPENSE", label: "Achats frais généraux", accountNumber: "606300" },
];

export const BOOTSTRAP_NOTIFICATION_TYPES = [
  "INVOICE_OVERDUE",
  "QUOTE_EXPIRING",
  "PAYMENT_RECEIVED",
  "SUPPLIER_INVOICE_DUE",
  "ACCOUNTING_ENTRY_UNBALANCED",
  "EXPORT_COMPLETED",
] as const;

export const BOOTSTRAP_EXPENSE_CATEGORY = {
  name: "Achats généraux",
  description: "Catégorie de dépenses par défaut",
  accountingAccountPlaceholder: "606300",
};

export const BOOTSTRAP_DOCUMENT_TEMPLATES: {
  type: DocumentType;
  name: string;
  description: string;
  headerText: string;
  footerText: string;
  isDefault: boolean;
}[] = [
  {
    type: "QUOTE",
    name: "Devis standard",
    description: "Modèle de devis commercial",
    headerText: "{{organizationName}} — Devis {{documentNumber}}",
    footerText: "Devis valable selon les conditions indiquées.",
    isDefault: true,
  },
  {
    type: "INVOICE",
    name: "Facture standard",
    description: "Modèle de facture client",
    headerText: "{{organizationName}} — Facture {{documentNumber}}",
    footerText: "Document généré par Nova Gestion.",
    isDefault: true,
  },
  {
    type: "CREDIT_NOTE",
    name: "Avoir standard",
    description: "Modèle d'avoir client",
    headerText: "{{organizationName}} — Avoir {{documentNumber}}",
    footerText: "Avoir client.",
    isDefault: true,
  },
  {
    type: "PAYMENT_RECEIPT",
    name: "Reçu de paiement",
    description: "Accusé de réception de paiement",
    headerText: "Reçu {{documentNumber}} — {{customerName}}",
    footerText: "Reçu de paiement.",
    isDefault: true,
  },
  {
    type: "REMINDER",
    name: "Relance client",
    description: "Lettre de relance",
    headerText: "Relance — {{documentNumber}}",
    footerText: "Merci de régulariser votre situation.",
    isDefault: true,
  },
  {
    type: "SUPPLIER_INVOICE",
    name: "Facture fournisseur",
    description: "Facture fournisseur reçue",
    headerText: "{{supplierName}} — {{documentNumber}}",
    footerText: "Pièce fournisseur.",
    isDefault: true,
  },
  {
    type: "ACCOUNTING_EXPORT",
    name: "Export comptable",
    description: "En-tête exports comptables",
    headerText: "{{organizationName}} — Export comptable",
    footerText: "Export comptable.",
    isDefault: true,
  },
];

export const BOOTSTRAP_COMMERCIAL_FOOTER = "Conditions générales disponibles sur demande.";
export const BOOTSTRAP_INVOICE_FOOTER = "Merci pour votre confiance.";
