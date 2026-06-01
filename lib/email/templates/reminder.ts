import { formatCurrency, formatDate, renderEmailLayout } from "@/lib/email/templates/layout";

export type ReminderEmailTemplateParams = {
  organizationName: string;
  recipientName: string;
  invoiceNumber: string;
  subject: string;
  message: string;
  amountDue: number;
  dueDate: Date;
  daysOverdue: number;
  documentUrl?: string | null;
};

export function buildReminderEmail(params: ReminderEmailTemplateParams) {
  const greeting = params.recipientName ? `Bonjour ${params.recipientName},` : "Bonjour,";

  const parts = [
    `<p>${greeting}</p>`,
    `<p>${params.message.replace(/\n/g, "<br />")}</p>`,
    `<p>Facture concernée : <strong>${params.invoiceNumber}</strong>.</p>`,
    `<p>Montant restant dû : <strong>${formatCurrency(params.amountDue)}</strong>.</p>`,
    `<p>Échéance initiale : ${formatDate(params.dueDate)} (${params.daysOverdue} jour(s) de retard).</p>`,
  ];

  if (params.documentUrl) {
    parts.push(
      `<p><a href="${params.documentUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Voir la facture</a></p>`,
    );
  }

  const { html, text } = renderEmailLayout({
    organizationName: params.organizationName,
    title: "Relance de paiement",
    bodyHtml: parts.join("\n"),
  });

  return { subject: params.subject, html, text };
}
