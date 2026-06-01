import { z } from "zod";

const reminderLevelEnum = z.enum([
  "FRIENDLY",
  "FIRST_NOTICE",
  "SECOND_NOTICE",
  "FINAL_NOTICE",
]);

const reminderChannelEnum = z.enum(["EMAIL", "PHONE", "LETTER", "MANUAL"]);

const reminderNoteTypeEnum = z.enum([
  "GENERAL",
  "CALL",
  "EMAIL",
  "DISPUTE",
  "PROMISE_TO_PAY",
  "INTERNAL",
]);

export const sendReminderSimulationSchema = z.object({
  invoiceId: z.string().min(1),
  recipientEmail: z.string().email("Email invalide"),
  level: reminderLevelEnum,
  channel: reminderChannelEnum.default("EMAIL"),
  subject: z.string().min(1, "L'objet est obligatoire"),
  message: z.string().min(1, "Le message est obligatoire"),
  includePaymentLinkPlaceholder: z.coerce.boolean().optional().default(false),
  internalNotes: z.string().optional().nullable(),
});

export const bulkSendReminderSimulationSchema = z.object({
  invoiceIds: z.array(z.string().min(1)).min(1).max(20),
});

export const reminderFilterSchema = z.object({
  q: z.string().optional(),
  level: reminderLevelEnum.optional(),
  customerId: z.string().optional(),
  daysOverdueMin: z.coerce.number().optional(),
  daysOverdueMax: z.coerce.number().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  noReminder: z.enum(["true", "false"]).optional(),
  reminded: z.enum(["true", "false"]).optional(),
  disputed: z.enum(["true", "false"]).optional(),
  paused: z.enum(["true", "false"]).optional(),
  promised: z.enum(["true", "false"]).optional(),
  paymentStatus: z.enum(["UNPAID", "PARTIALLY_PAID", "OVERDUE"]).optional(),
  quickFilter: z
    .enum(["1-7", "8-30", "31-60", "60+", "no-reminder", "disputed", "paused", "promised"])
    .optional(),
  sortBy: z
    .enum(["daysOverdue", "amountDue", "dueDate", "customer", "reminderCount", "lastReminderAt"])
    .optional()
    .default("daysOverdue"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const reminderHistoryFilterSchema = z.object({
  q: z.string().optional(),
  customerId: z.string().optional(),
  invoiceId: z.string().optional(),
  level: reminderLevelEnum.optional(),
  status: z.enum(["DRAFT", "SIMULATED_SENT", "CANCELLED"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const createReminderTemplateSchema = z.object({
  name: z.string().min(1),
  level: reminderLevelEnum,
  subject: z.string().min(1),
  message: z.string().min(1),
  isDefault: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true),
});

export const updateReminderTemplateSchema = createReminderTemplateSchema.partial();

export const createReminderNoteSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  reminderId: z.string().optional().nullable(),
  type: reminderNoteTypeEnum,
  content: z.string().min(2, "La note doit contenir au moins 2 caractères"),
});

export const pauseCollectionSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().min(3, "La raison doit contenir au moins 3 caractères"),
});

export const markInvoiceDisputedSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().min(3, "La raison doit contenir au moins 3 caractères"),
});

export const setPromisedPaymentDateSchema = z.object({
  invoiceId: z.string().min(1),
  promisedPaymentDate: z.coerce.date(),
  note: z.string().optional().nullable(),
});

export type SendReminderSimulationInput = z.infer<typeof sendReminderSimulationSchema>;
export type ReminderFilterInput = z.infer<typeof reminderFilterSchema>;
export type ReminderHistoryFilterInput = z.infer<typeof reminderHistoryFilterSchema>;
