export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function formatLocalizationPreview(locale: string, dateFormat: string) {
  const sampleDate = new Date(2025, 4, 29, 14, 30);
  const date = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(sampleDate);
  const amount = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(1250.5);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
    0.425,
  );
  return { date, amount, percent, dateFormat };
}

export const TAX_RATE_TYPE_LABELS: Record<string, string> = {
  VAT: "TVA",
  EXEMPT: "Exonéré",
  REVERSE_CHARGE: "Autoliquidation",
  OTHER: "Autre",
};

export const ACCOUNTING_MAPPING_TYPE_LABELS: Record<string, string> = {
  CUSTOMER_RECEIVABLE: "Clients",
  SUPPLIER_PAYABLE: "Fournisseurs",
  BANK: "Banque",
  CASH: "Caisse",
  SALES_SERVICE: "Ventes services",
  SALES_PRODUCT: "Ventes produits",
  VAT_COLLECTED: "TVA collectée",
  VAT_DEDUCTIBLE: "TVA déductible",
  PURCHASE_EXPENSE: "Achats / charges",
  DISCOUNT: "Remises",
  OTHER: "Autre",
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  INVOICE_OVERDUE: "Facture client en retard",
  QUOTE_EXPIRING: "Devis bientôt expiré",
  PAYMENT_RECEIVED: "Paiement reçu",
  SUPPLIER_INVOICE_DUE: "Facture fournisseur à payer",
  ACCOUNTING_ENTRY_UNBALANCED: "Écriture non équilibrée",
  EXPORT_COMPLETED: "Export terminé",
};

export const CUSTOM_FIELD_ENTITY_LABELS: Record<string, string> = {
  CUSTOMER: "Client",
  SUPPLIER: "Fournisseur",
  ITEM: "Article / service",
  QUOTE: "Devis",
  INVOICE: "Facture",
  SUPPLIER_INVOICE: "Facture fournisseur",
};
