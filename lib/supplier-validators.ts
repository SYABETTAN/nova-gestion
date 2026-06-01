import { z } from "zod";

const optionalEmail = z
  .string()
  .email("Email invalide")
  .optional()
  .or(z.literal(""));

const optionalUrl = z
  .string()
  .url("URL invalide")
  .optional()
  .or(z.literal(""));

export const supplierBaseSchema = {
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  type: z.enum(["COMPANY", "INDIVIDUAL"]).default("COMPANY"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  legalName: z.string().optional(),
  displayName: z.string().optional(),
  email: optionalEmail,
  phone: z.string().optional(),
  website: optionalUrl,
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  legalForm: z.string().optional(),
  industry: z.string().optional(),
  categoryId: z.string().optional().or(z.literal("")),
  defaultPaymentTermsDays: z.coerce.number().min(0).max(120).default(30),
  defaultVatRate: z.coerce.number().min(0).max(100).default(20),
  currency: z.string().length(3).default("EUR"),
  outstandingAmount: z.coerce.number().min(0).default(0),
  totalPurchasesAmount: z.coerce.number().min(0).default(0),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
  isPreferred: z.coerce.boolean().optional(),
  notes: z.string().optional(),
};

export const createSupplierSchema = z.object({
  ...supplierBaseSchema,
  addressType: z.enum(["BILLING", "SHIPPING", "HEADQUARTERS", "OTHER"]).optional(),
  addressLabel: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().length(2).default("FR"),
  contactFirstName: z.string().optional(),
  contactLastName: z.string().optional(),
  contactJobTitle: z.string().optional(),
  contactEmail: optionalEmail,
  contactPhone: z.string().optional(),
  contactMobile: z.string().optional(),
  bankLabel: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  tagIds: z.string().optional(),
  noteContent: z.string().optional(),
});

export const updateSupplierSchema = z.object({
  ...supplierBaseSchema,
  tagIds: z.string().optional(),
});

export const supplierFilterSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  city: z.string().optional(),
  riskLevel: z.string().optional(),
  preferred: z.enum(["true", "false"]).optional(),
  archived: z.enum(["true", "false", "only"]).optional(),
  sortBy: z
    .enum(["name", "createdAt", "outstandingAmount", "totalPurchasesAmount", "riskLevel", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const createSupplierContactSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  jobTitle: z.string().optional(),
  email: optionalEmail,
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isPrimary: z.coerce.boolean().optional(),
  notes: z.string().optional(),
});

export const updateSupplierContactSchema = createSupplierContactSchema;

export const createSupplierAddressSchema = z.object({
  type: z.enum(["BILLING", "SHIPPING", "HEADQUARTERS", "OTHER"]).default("BILLING"),
  label: z.string().optional(),
  addressLine1: z.string().min(1, "Adresse requise"),
  addressLine2: z.string().optional(),
  postalCode: z.string().min(1, "Code postal requis"),
  city: z.string().min(1, "Ville requise"),
  region: z.string().optional(),
  country: z.string().length(2).default("FR"),
  isDefault: z.coerce.boolean().optional(),
});

export const updateSupplierAddressSchema = createSupplierAddressSchema;

export const createSupplierBankAccountSchema = z.object({
  label: z.string().min(1, "Libellé requis"),
  iban: z.string().min(1, "IBAN requis"),
  bic: z.string().optional(),
  bankName: z.string().optional(),
  accountHolder: z.string().optional(),
  isDefault: z.coerce.boolean().optional(),
});

export const updateSupplierBankAccountSchema = createSupplierBankAccountSchema;

export const createSupplierNoteSchema = z.object({
  content: z.string().min(2, "Contenu requis"),
});

export const assignSupplierTagsSchema = z.object({
  tagIds: z.string().min(1),
});

export const createSupplierCategorySchema = z.object({
  name: z.string().min(2, "Nom requis"),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const createSupplierTagSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  color: z.string().optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierFilterInput = z.infer<typeof supplierFilterSchema>;
