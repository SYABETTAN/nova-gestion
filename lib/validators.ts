import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Minimum 8 caractères"),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, "Nom commercial requis"),
  legalName: z.string().min(1, "Nom légal requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url("URL invalide").optional().or(z.literal("")),
  logoUrl: z.string().optional(),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  legalForm: z.string().optional(),
  shareCapital: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().min(2).max(2),
  defaultCurrency: z.string().min(3).max(3),
  defaultLocale: z.string().min(2),
  timezone: z.string().min(1),
  fiscalYearStartMonth: z.coerce.number().min(1).max(12),
  defaultPaymentTermsDays: z.coerce.number().min(0).max(365),
  defaultInvoiceFooter: z.string().optional(),
  defaultQuoteFooter: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hex invalide"),
  documentPrefix: z.string().min(1).max(10),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Email invalide"),
  roleKey: z.enum(["OWNER", "ADMIN", "ACCOUNTANT", "SALES", "READ_ONLY"]),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().min(1),
  roleKey: z.enum(["OWNER", "ADMIN", "ACCOUNTANT", "SALES", "READ_ONLY"]),
});

export const updateMemberStatusSchema = z.object({
  memberId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const updateNumberingSequenceSchema = z.object({
  id: z.string().min(1),
  prefix: z.string().min(1, "Préfixe requis"),
  nextNumber: z.coerce.number().min(1),
  padding: z.coerce.number().min(1).max(10),
  suffix: z.string(),
  resetPeriod: z.enum(["NEVER", "YEARLY", "MONTHLY"]),
});

export const auditLogFilterSchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional(),
  entityType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export const acceptInvitationSchema = z.object({
  token: z.string().min(32, "Token d'invitation invalide"),
  name: z.string().min(2, "Nom requis").optional(),
  password: z.string().min(8, "Minimum 8 caractères").optional(),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type UpdateNumberingSequenceInput = z.infer<
  typeof updateNumberingSequenceSchema
>;
export type AuditLogFilterInput = z.infer<typeof auditLogFilterSchema>;
