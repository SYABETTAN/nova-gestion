import { formatCurrency, formatDate, renderEmailLayout } from "@/lib/email/templates/layout";
import type { MoneyInput } from "@/lib/money";

export type QuoteEmailTemplateParams = {
  organizationName: string;
  recipientName: string;
  quoteNumber: string;
  quoteTitle?: string | null;
  totalIncludingTax: MoneyInput;
  validUntil?: Date | null;
  customMessage?: string | null;
  documentUrl?: string | null;
};

export function buildQuoteEmail(params: QuoteEmailTemplateParams) {
  const subject = `Devis ${params.quoteNumber} — ${params.organizationName}`;
  const greeting = params.recipientName ? `Bonjour ${params.recipientName},` : "Bonjour,";

  const summary = [
    `<p>${greeting}</p>`,
    `<p>Vous trouverez ci-joint notre devis <strong>${params.quoteNumber}</strong>${params.quoteTitle ? ` — ${params.quoteTitle}` : ""}.</p>`,
    `<p>Montant TTC : <strong>${formatCurrency(params.totalIncludingTax)}</strong>.</p>`,
  ];

  if (params.validUntil) {
    summary.push(`<p>Validité du devis : ${formatDate(params.validUntil)}.</p>`);
  }

  if (params.customMessage?.trim()) {
    summary.push(`<p>${params.customMessage.trim().replace(/\n/g, "<br />")}</p>`);
  }

  if (params.documentUrl) {
    summary.push(
      `<p><a href="${params.documentUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Consulter le devis</a></p>`,
    );
  }

  summary.push("<p>Restant à votre disposition pour toute question.</p>");

  const { html, text } = renderEmailLayout({
    organizationName: params.organizationName,
    title: `Devis ${params.quoteNumber}`,
    bodyHtml: summary.join("\n"),
  });

  return { subject, html, text };
}
