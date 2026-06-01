import { moneyToNumber, type MoneyInput } from "@/lib/money";

export type EmailLayoutParams = {
  organizationName: string;
  title: string;
  bodyHtml: string;
  footerNote?: string;
};

export function renderEmailLayout(params: EmailLayoutParams): { html: string; text: string } {
  const footer =
    params.footerNote ??
    `${params.organizationName} — message transactionnel envoyé via Nova Gestion.`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="color: #64748b; font-size: 14px; margin: 0 0 8px;">${escapeHtml(params.organizationName)}</p>
  <h1 style="font-size: 20px; margin: 0 0 16px;">${escapeHtml(params.title)}</h1>
  ${params.bodyHtml}
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="font-size: 12px; color: #64748b; margin: 0;">${escapeHtml(footer)}</p>
</body>
</html>`;

  const text = `${params.organizationName}\n\n${params.title}\n\n${stripHtml(params.bodyHtml)}\n\n---\n${footer}`;

  return { html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatCurrency(amount: MoneyInput, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(moneyToNumber(amount));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}
