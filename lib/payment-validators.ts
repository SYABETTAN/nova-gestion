import { z } from "zod";

const paymentMethodEnum = z.enum([
  "BANK_TRANSFER",
  "CARD",
  "CHECK",
  "CASH",
  "DIRECT_DEBIT",
  "OTHER",
]);

const paymentStatusEnum = z.enum([
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_ALLOCATED",
  "FULLY_ALLOCATED",
  "CANCELLED",
]);

export const paymentAllocationInputSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
});

export const createPaymentSchema = z.object({
  customerId: z.string().min(1, "Le client est obligatoire"),
  paymentDate: z.coerce.date(),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  currency: z.string().default("EUR"),
  method: paymentMethodEnum,
  reference: z.string().optional().nullable(),
  bankReference: z.string().optional().nullable(),
  checkNumber: z.string().optional().nullable(),
  cardLast4: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v.length === 4, "4 chiffres requis pour la carte"),
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  autoAllocate: z.coerce.boolean().optional().default(false),
  allocations: z.array(paymentAllocationInputSchema).optional().default([]),
});

export const updatePaymentSchema = createPaymentSchema
  .omit({ autoAllocate: true, allocations: true })
  .partial()
  .extend({
    customerId: z.string().min(1).optional(),
    paymentDate: z.coerce.date().optional(),
    amount: z.coerce.number().positive().optional(),
    method: paymentMethodEnum.optional(),
  });

export const allocatePaymentSchema = z.object({
  paymentId: z.string().min(1),
  allocations: z
    .array(paymentAllocationInputSchema)
    .min(1, "Au moins une allocation est requise"),
});

export const deallocatePaymentSchema = z.object({
  paymentId: z.string().min(1),
  invoiceId: z.string().min(1),
});

export const cancelPaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().min(3, "La raison doit contenir au moins 3 caractères"),
});

export const paymentFilterSchema = z.object({
  q: z.string().optional(),
  status: paymentStatusEnum.optional(),
  method: paymentMethodEnum.optional(),
  customerId: z.string().optional(),
  paymentDateFrom: z.string().optional(),
  paymentDateTo: z.string().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  unallocated: z.enum(["true", "false"]).optional(),
  cancelled: z.enum(["true", "false"]).optional(),
  sortBy: z
    .enum([
      "paymentDate",
      "createdAt",
      "amount",
      "unallocatedAmount",
      "customer",
      "status",
      "method",
    ])
    .optional()
    .default("paymentDate"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const sendPaymentReceiptSimulationSchema = z.object({
  recipient: z.string().email("Email invalide"),
  subject: z.string().min(1),
  message: z.string().min(1),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>;
export type AllocatePaymentInput = z.infer<typeof allocatePaymentSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>;
export type DeallocatePaymentInput = z.infer<typeof deallocatePaymentSchema>;
export type SendPaymentReceiptSimulationInput = z.infer<
  typeof sendPaymentReceiptSimulationSchema
>;
