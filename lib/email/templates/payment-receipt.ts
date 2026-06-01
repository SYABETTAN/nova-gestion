import { formatCurrency, formatDate, renderEmailLayout } from "@/lib/email/templates/layout";
import type { MoneyInput } from "@/lib/money";

export type PaymentReceiptEmailTemplateParams = {
  organizationName: string;
  recipientName: string;
  paymentNumber: string;
  invoiceNumber?: string | null;
  amount: MoneyInput;
  paidAt: Date;
  paymentMethod?: string | null;
  customMessage?: string | null;
};

export function buildPaymentReceiptEmail(params: PaymentReceiptEmailTemplateParams) {
  const subject = `Reçu de paiement ${params.paymentNumber} — ${params.organizationName}`;
  const greeting = params.recipientName ? `Bonjour ${params.recipientName},` : "Bonjour,";

  const parts = [
    `<p>${greeting}</p>`,
    `<p>Nous confirmons la réception de votre paiement <strong>${params.paymentNumber}</strong>.</p>`,
    `<p>Montant : <strong>${formatCurrency(params.amount)}</strong>.</p>`,
    `<p>Date : ${formatDate(params.paidAt)}.</p>`,
  ];

  if (params.invoiceNumber) {
    parts.push(`<p>Facture associée : <strong>${params.invoiceNumber}</strong>.</p>`);
  }

  if (params.paymentMethod) {
    parts.push(`<p>Mode de paiement : ${params.paymentMethod}.</p>`);
  }

  if (params.customMessage?.trim()) {
    parts.push(`<p>${params.customMessage.trim().replace(/\n/g, "<br />")}</p>`);
  }

  parts.push("<p>Merci pour votre règlement.</p>");

  const { html, text } = renderEmailLayout({
    organizationName: params.organizationName,
    title: `Reçu ${params.paymentNumber}`,
    bodyHtml: parts.join("\n"),
  });

  return { subject, html, text };
}
