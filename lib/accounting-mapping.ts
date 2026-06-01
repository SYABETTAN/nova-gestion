const EXPENSE_CATEGORY_ACCOUNT_MAP: Record<string, string> = {
  Logiciels: "615000",
  "Sous-traitance": "611000",
  Fournitures: "606300",
  Télécommunications: "626000",
  Transport: "622600",
  Marketing: "622600",
  Conseil: "622600",
  Maintenance: "615000",
  "Frais bancaires": "627000",
  "Services généraux": "606300",
};

export const SYSTEM_ACCOUNT_NUMBERS = {
  CAPITAL: "101000",
  SUPPLIERS: "401000",
  CUSTOMERS: "411000",
  BANK: "512000",
  CASH: "530000",
  SUPPLIES: "606300",
  PURCHASES: "607000",
  SUBCONTRACTING: "611000",
  MAINTENANCE: "615000",
  FEES: "622600",
  TELECOM: "626000",
  BANK_FEES: "627000",
  SERVICES: "706000",
  GOODS_SALES: "707000",
  DISCOUNTS: "709000",
  VAT_DEDUCTIBLE: "445660",
  VAT_COLLECTED: "445710",
  VAT_DUE: "445510",
  MISC_REVENUE: "758000",
  MISC_EXPENSE: "658000",
} as const;

export function mapExpenseCategoryToAccount(
  categoryName?: string | null,
  placeholder?: string | null,
): string {
  if (placeholder) return placeholder;
  if (categoryName && EXPENSE_CATEGORY_ACCOUNT_MAP[categoryName]) {
    return EXPENSE_CATEGORY_ACCOUNT_MAP[categoryName]!;
  }
  return SYSTEM_ACCOUNT_NUMBERS.FEES;
}

export function getRevenueAccountForInvoice(hasProductLines: boolean): string {
  return hasProductLines ? SYSTEM_ACCOUNT_NUMBERS.GOODS_SALES : SYSTEM_ACCOUNT_NUMBERS.SERVICES;
}

export function getBankOrCashAccount(method: string): string {
  return method === "CASH" ? SYSTEM_ACCOUNT_NUMBERS.CASH : SYSTEM_ACCOUNT_NUMBERS.BANK;
}

export const ACCOUNTING_JOURNAL_CODES = {
  SALES: "VE",
  PURCHASES: "AC",
  BANK: "BQ",
  CASH: "CA",
  MISCELLANEOUS: "OD",
} as const;

export const ACCOUNTING_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Saisie manuelle",
  CUSTOMER_INVOICE: "Facture client",
  CUSTOMER_PAYMENT: "Paiement client",
  CUSTOMER_CREDIT_NOTE: "Avoir client",
  SUPPLIER_INVOICE: "Facture fournisseur",
  SUPPLIER_PAYMENT_PLACEHOLDER: "Paiement fournisseur",
  OPENING_BALANCE: "Solde d'ouverture",
  OTHER: "Autre",
};

export const ACCOUNTING_ENTRY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validée",
  CANCELLED: "Annulée",
};

export const ACCOUNTING_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: "Actif",
  LIABILITY: "Passif",
  EQUITY: "Capitaux",
  REVENUE: "Produit",
  EXPENSE: "Charge",
  TAX: "Taxe",
  CUSTOMER: "Client",
  SUPPLIER: "Fournisseur",
  BANK: "Banque",
  OTHER: "Autre",
};

export const ACCOUNTING_JOURNAL_TYPE_LABELS: Record<string, string> = {
  SALES: "Ventes",
  PURCHASES: "Achats",
  BANK: "Banque",
  CASH: "Caisse",
  MISCELLANEOUS: "Opérations diverses",
};
