import { notFound } from "next/navigation";
import { QuotePreview } from "@/components/quotes/quote-preview";
import { QuotePrintActions } from "@/components/quotes/quote-print-actions";
import { requireAuth } from "@/lib/auth";
import { getQuoteByIdAction, getQuoteFormDataAction } from "@/server/actions/quote.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function QuotePrintPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  const [quote, formData] = await Promise.all([
    getQuoteByIdAction(id),
    getQuoteFormDataAction(),
  ]);

  if (!quote) notFound();

  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <div className="mb-6 print:hidden">
        <QuotePrintActions />
      </div>
      <QuotePreview quote={quote} organization={formData.organization} compact />
    </div>
  );
}
