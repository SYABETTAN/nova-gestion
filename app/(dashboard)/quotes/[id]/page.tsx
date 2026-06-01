import { notFound } from "next/navigation";
import { QuoteDetailClient } from "@/components/quotes/quote-detail-client";
import { requireAuth } from "@/lib/auth";
import { getQuoteByIdAction, getQuoteFormDataAction } from "@/server/actions/quote.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function QuoteDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const [quote, formData] = await Promise.all([
    getQuoteByIdAction(id),
    getQuoteFormDataAction(),
  ]);

  if (!quote) notFound();

  return (
    <QuoteDetailClient
      user={user}
      quote={quote}
      organization={formData.organization}
    />
  );
}
