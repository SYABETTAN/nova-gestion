import type { ReminderLevel } from "@prisma/client";
import { formatCurrency } from "@/lib/pricing";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";

export type TemplateVariables = {
  customerName: string;
  invoiceNumber: string;
  invoiceDueDate: string;
  invoiceAmountDue: string;
  daysOverdue: string;
  organizationName: string;
  paymentLink: string;
};

export const TEMPLATE_VARIABLES = [
  "{{customerName}}",
  "{{invoiceNumber}}",
  "{{invoiceDueDate}}",
  "{{invoiceAmountDue}}",
  "{{daysOverdue}}",
  "{{organizationName}}",
  "{{paymentLink}}",
] as const;

export function buildPaymentLinkPlaceholder(invoiceNumber: string): string {
  return `https://pay.example.com/${invoiceNumber}`;
}

export function renderReminderTemplate(
  template: string,
  vars: TemplateVariables,
): string {
  return template
    .replaceAll("{{customerName}}", vars.customerName)
    .replaceAll("{{invoiceNumber}}", vars.invoiceNumber)
    .replaceAll("{{invoiceDueDate}}", vars.invoiceDueDate)
    .replaceAll("{{invoiceAmountDue}}", vars.invoiceAmountDue)
    .replaceAll("{{daysOverdue}}", vars.daysOverdue)
    .replaceAll("{{organizationName}}", vars.organizationName)
    .replaceAll("{{paymentLink}}", vars.paymentLink);
}

export function buildTemplateVariables(input: {
  customerName: string;
  invoiceNumber: string;
  dueDate: Date;
  amountDue: MoneyInput;
  currency?: string;
  daysOverdue: number;
  organizationName: string;
  includePaymentLink?: boolean;
}): TemplateVariables {
  const paymentLink = input.includePaymentLink
    ? buildPaymentLinkPlaceholder(input.invoiceNumber)
    : "";
  return {
    customerName: input.customerName,
    invoiceNumber: input.invoiceNumber,
    invoiceDueDate: formatDateShort(input.dueDate),
    invoiceAmountDue: formatCurrency(input.amountDue, input.currency ?? "EUR"),
    daysOverdue: String(input.daysOverdue),
    organizationName: input.organizationName,
    paymentLink,
  };
}

export const DEFAULT_REMINDER_TEMPLATES: {
  name: string;
  level: ReminderLevel;
  subject: string;
  message: string;
}[] = [
  {
    name: "Relance amiable",
    level: "FRIENDLY",
    subject: "Rappel amiable — facture {{invoiceNumber}}",
    message: `Bonjour {{customerName}},

Sauf erreur de notre part, la facture {{invoiceNumber}} d'un montant restant dû de {{invoiceAmountDue}} est arrivée à échéance le {{invoiceDueDate}}.

Elle présente actuellement un retard de {{daysOverdue}} jour(s).

Nous vous remercions de bien vouloir procéder au règlement dès que possible.

{{paymentLink}}

Cordialement,
{{organizationName}}`,
  },
  {
    name: "Première relance",
    level: "FIRST_NOTICE",
    subject: "Première relance — facture {{invoiceNumber}}",
    message: `Bonjour {{customerName}},

Nous constatons que la facture {{invoiceNumber}} reste impayée à ce jour pour un montant de {{invoiceAmountDue}}.

Cette facture est échue depuis {{daysOverdue}} jour(s).

Nous vous invitons à régulariser la situation rapidement.

{{paymentLink}}

Cordialement,
{{organizationName}}`,
  },
  {
    name: "Deuxième relance",
    level: "SECOND_NOTICE",
    subject: "Deuxième relance — facture {{invoiceNumber}}",
    message: `Bonjour {{customerName}},

Malgré notre précédente relance, la facture {{invoiceNumber}} reste impayée.

Le montant restant dû est de {{invoiceAmountDue}}, avec un retard de {{daysOverdue}} jour(s).

Merci de procéder au règlement ou de nous contacter en cas de difficulté.

{{paymentLink}}

Cordialement,
{{organizationName}}`,
  },
  {
    name: "Dernière relance",
    level: "FINAL_NOTICE",
    subject: "Dernière relance avant action — facture {{invoiceNumber}}",
    message: `Bonjour {{customerName}},

Nous vous informons que la facture {{invoiceNumber}}, d'un montant restant dû de {{invoiceAmountDue}}, demeure impayée malgré nos précédentes relances.

Cette facture présente un retard de {{daysOverdue}} jour(s).

Sans retour de votre part, nous pourrons engager les démarches nécessaires au recouvrement.

{{paymentLink}}

Cordialement,
{{organizationName}}`,
  },
];
