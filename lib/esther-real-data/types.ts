export type EstherAddressInput = {
  type: "BILLING" | "SHIPPING" | "HEADQUARTERS" | "OTHER";
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  country?: string;
  isDefault?: boolean;
};

export type EstherContactInput = {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary?: boolean;
};

export type EstherCustomerSeed = {
  importKey: string;
  name: string;
  legalName?: string;
  displayName?: string;
  siren?: string;
  siret?: string;
  vatNumber?: string;
  legalForm?: string;
  industry?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  sourceDocument?: string;
  addresses: EstherAddressInput[];
  contacts?: EstherContactInput[];
  metadata?: Record<string, string>;
};

export type EstherSupplierSeed = {
  importKey: string;
  name: string;
  legalName?: string;
  siret?: string;
  vatNumber?: string;
  legalForm?: string;
  email?: string;
  phone?: string;
  notes?: string;
  sourceDocument?: string;
  addresses: EstherAddressInput[];
  bankAccount?: {
    label: string;
    iban: string;
    bic?: string;
    bankName?: string;
    accountHolder?: string;
  };
  metadata?: Record<string, string>;
};

export type EstherProductSeed = {
  sku: string;
  name: string;
  description?: string;
  shortDescription?: string;
  purchasePriceExcludingTax?: number;
  defaultVatRate?: number;
  supplierImportKey?: string;
  sourceDocument?: string;
  composition?: string;
  notes?: string;
};

export type EstherSupplierInvoiceLineSeed = {
  reference: string;
  name: string;
  description?: string;
  quantity: number;
  unitPriceExcludingTax: number;
  discountAmount?: number;
  vatRate?: number;
  unit?: string;
};

export type EstherSupplierInvoiceSeed = {
  importKey: string;
  supplierImportKey: string;
  supplierReference: string;
  title: string;
  issueDate: string;
  receivedDate: string;
  dueDate: string;
  currency?: string;
  defaultVatRate?: number;
  subtotalExcludingTax?: number;
  totalDiscountAmount?: number;
  totalExcludingTax: number;
  totalVatAmount: number;
  totalIncludingTax: number;
  amountPaid?: number;
  amountDue?: number;
  internalNotes?: string;
  sourcePdf?: string;
  lines: EstherSupplierInvoiceLineSeed[];
  pendingPdf?: boolean;
};

export type EstherDocumentSeed = {
  importKey: string;
  fileName: string;
  relativePdfPath: string;
  title: string;
  description?: string;
  type: "OTHER" | "SUPPLIER_INVOICE" | "SUPPLIER_ATTACHMENT";
  entityType: "Customer" | "Supplier" | "SupplierInvoice";
  entityImportKey: string;
};

export type EstherImportReport = {
  organizationId: string;
  organizationName: string;
  customers: { importKey: string; id: string; action: "created" | "updated" }[];
  suppliers: { importKey: string; id: string; action: "created" | "updated" }[];
  products: { sku: string; id: string; action: "created" | "updated" }[];
  supplierInvoices: { importKey: string; id: string; action: "created" | "updated" | "skipped" }[];
  documents: { importKey: string; id: string; action: "created" | "updated" | "skipped" }[];
  warnings: string[];
  skipped: string[];
};
