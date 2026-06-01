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

export const customerBaseSchema = {
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  type: z.enum(["COMPANY", "INDIVIDUAL"]).default("COMPANY"),
  status: z.enum(["PROSPECT", "ACTIVE", "INACTIVE"]).default("PROSPECT"),
  legalName: z.string().optional(),
  displayName: z.string().optional(),
  email: optionalEmail,
  phone: z.string().optional(),
  website: optionalUrl,
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  legalForm: z.string().optional(),
  industry: z.string().optional(),
  employeeCount: z.coerce.number().min(0).optional().or(z.literal("")),
  annualRevenue: z.coerce.number().min(0).optional().or(z.literal("")),
  defaultPaymentTermsDays: z.coerce.number().min(0).max(120).default(30),
  defaultVatRate: z.coerce.number().min(0).max(100).default(20),
  currency: z.string().length(3).default("EUR"),
  creditLimit: z.coerce.number().min(0).default(0),
  outstandingAmount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
};

export const createCustomerSchema = z.object({
  ...customerBaseSchema,
  addressType: z.enum(["BILLING", "SHIPPING", "OTHER"]).optional(),
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
  tagIds: z.string().optional(),
  noteContent: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  ...customerBaseSchema,
  tagIds: z.string().optional(),
});

export const customerFilterSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  tagId: z.string().optional(),
  city: z.string().optional(),
  archived: z.enum(["true", "false", "only"]).optional(),
  sortBy: z.enum(["name", "createdAt", "outstandingAmount", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const createCustomerContactSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  jobTitle: z.string().optional(),
  email: optionalEmail,
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isPrimary: z.coerce.boolean().optional(),
  notes: z.string().optional(),
});

export const updateCustomerContactSchema = createCustomerContactSchema;

export const createCustomerAddressSchema = z.object({
  type: z.enum(["BILLING", "SHIPPING", "OTHER"]).default("BILLING"),
  label: z.string().optional(),
  addressLine1: z.string().min(1, "Adresse requise"),
  addressLine2: z.string().optional(),
  postalCode: z.string().min(1, "Code postal requis"),
  city: z.string().min(1, "Ville requise"),
  region: z.string().optional(),
  country: z.string().length(2).default("FR"),
  isDefault: z.coerce.boolean().optional(),
});

export const updateCustomerAddressSchema = createCustomerAddressSchema;

export const createCustomerNoteSchema = z.object({
  content: z.string().min(1, "Contenu requis"),
});

export const assignCustomerTagsSchema = z.object({
  tagIds: z.string().min(1),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
