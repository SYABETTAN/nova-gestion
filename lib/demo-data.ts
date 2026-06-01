export const DEMO_PASSWORD = "DevSample123!";

export const DEMO_USERS = [
  {
    email: "owner@dev.local",
    name: "Owner Dev",
    role: "OWNER" as const,
  },
  {
    email: "admin@dev.local",
    name: "Admin Dev",
    role: "ADMIN" as const,
  },
  {
    email: "accountant@dev.local",
    name: "Comptable Dev",
    role: "ACCOUNTANT" as const,
  },
  {
    email: "sales@dev.local",
    name: "Commercial Dev",
    role: "SALES" as const,
  },
  {
    email: "readonly@dev.local",
    name: "Lecteur Dev",
    role: "READ_ONLY" as const,
  },
];

export const DEMO_ORGANIZATION = {
  name: "Nova Gestion",
  legalName: "Nova Gestion SAS",
  slug: "nova-gestion",
  siret: "12345678900012",
  vatNumber: "FR12123456789",
  legalForm: "SAS",
  shareCapital: "50000",
  addressLine1: "10 rue de la Paix",
  addressLine2: "",
  postalCode: "75002",
  city: "Paris",
  country: "FR",
  phone: "+33 1 23 45 67 89",
  email: "contact@nova-gestion.example",
  website: "https://nova-gestion.example",
  logoUrl: "/demo/logo-nova.svg",
  defaultCurrency: "EUR",
  defaultLocale: "fr-FR",
  timezone: "Europe/Paris",
  fiscalYearStartMonth: 1,
  defaultPaymentTermsDays: 30,
  defaultInvoiceFooter:
    "Nova Gestion SAS — SIRET 12345678900012 — TVA FR12123456789",
  defaultQuoteFooter: "Devis valable 30 jours — Conditions générales sur demande.",
  primaryColor: "#2563eb",
  documentPrefix: "NG",
};

export const DEMO_NUMBERING_SEQUENCES = [
  {
    type: "CUSTOMER" as const,
    prefix: "CLI-",
    nextNumber: 24,
    padding: 4,
    suffix: "",
    resetPeriod: "NEVER" as const,
  },
  {
    type: "SUPPLIER" as const,
    prefix: "FOU-",
    nextNumber: 12,
    padding: 4,
    suffix: "",
    resetPeriod: "NEVER" as const,
  },
  {
    type: "ITEM" as const,
    prefix: "ART-",
    nextNumber: 36,
    padding: 4,
    suffix: "",
    resetPeriod: "NEVER" as const,
  },
  {
    type: "QUOTE" as const,
    prefix: "DEV-{YYYY}-",
    nextNumber: 18,
    padding: 4,
    suffix: "",
    resetPeriod: "YEARLY" as const,
  },
  {
    type: "INVOICE" as const,
    prefix: "FAC-{YYYY}-",
    nextNumber: 42,
    padding: 4,
    suffix: "",
    resetPeriod: "YEARLY" as const,
  },
  {
    type: "CREDIT_NOTE" as const,
    prefix: "AVO-{YYYY}-",
    nextNumber: 5,
    padding: 4,
    suffix: "",
    resetPeriod: "YEARLY" as const,
  },
  {
    type: "PAYMENT" as const,
    prefix: "REG-{YYYY}-",
    nextNumber: 31,
    padding: 4,
    suffix: "",
    resetPeriod: "YEARLY" as const,
  },
  {
    type: "REMINDER" as const,
    prefix: "REL-{YYYY}-",
    nextNumber: 46,
    padding: 4,
    suffix: "",
    resetPeriod: "YEARLY" as const,
  },
  {
    type: "SUPPLIER_INVOICE" as const,
    prefix: "ACH-{YYYY}-",
    nextNumber: 14,
    padding: 4,
    suffix: "",
    resetPeriod: "YEARLY" as const,
  },
  {
    type: "ACCOUNTING_ENTRY" as const,
    prefix: "ECR-{YYYY}-",
    nextNumber: 73,
    padding: 5,
    suffix: "",
    resetPeriod: "YEARLY" as const,
  },
];


export {
  ROLE_LABELS,
  MEMBER_STATUS_LABELS,
  NUMBERING_TYPE_LABELS,
  RESET_PERIOD_LABELS,
  AUDIT_ACTION_LABELS,
} from "./app-labels";
