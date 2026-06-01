import { formatCurrency, formatDate, renderEmailLayout } from "@/lib/email/templates/layout";
import type { MoneyInput } from "@/lib/money";

export type InvoiceEmailTemplateParams = {
  organizationName: string;
  recipientName: string;
  invoiceNumber: string;
  invoiceTitle?: string | null;
  totalIncludingTax: MoneyInput;
  amountDue: MoneyInput;
  dueDate?: Date | null;
  customMessage?: string | null;
  documentUrl?: string | null;
};

export function buildInvoiceEmail(params: InvoiceEmailTemplateParams) {
  const subject = `Facture ${params.invoiceNumber} — ${params.organizationName}`;
  const greeting = params.recipientName ? `Bonjour ${params.recipientName},` : "Bonjour,";

  const parts = [
    `<p>${greeting}</p>`,
    `<p>Veuillez trouver ci-joint la facture <strong>${params.invoiceNumber}</strong>${params.invoiceTitle ? ` — ${params.invoiceTitle}` : ""}.</p>`,
    `<p>Montant TTC : <strong>${formatCurrency(params.totalIncludingTax)}</strong>.</p>`,
    `<p>Reste à payer : <strong>${formatCurrency(params.amountDue)}</strong>.</p>`,
  ];

  if (params.dueDate) {
    parts.push(`<p>Date d'échéance : ${formatDate(params.dueDate)}.</p>`);
  }

  if (params.customMessage?.trim()) {
    parts.push(`<p>${params.customMessage.trim().replace(/\n/g, "<br />")}</p>`);
  }

  if (params.documentUrl) {
    parts.push(
      `<p><a href="${params.documentUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Consulter la facture</a></p>`,
    );
  }

  parts.push("<p>Merci de votre confiance.</p>");

  const { html, text } = renderEmailLayout({
    organizationName: params.organizationName,
    title: `Facture ${params.invoiceNumber}`,
    bodyHtml: parts.join("\n"),
  });

  return { subject, html, text };
}
