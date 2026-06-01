import { QuotesPageClient } from "@/components/quotes/quotes-page-client";
import { requireAuth } from "@/lib/auth";
import {
  getCustomersForQuoteFilterAction,
  getQuoteStatsAction,
  listQuotesAction,
} from "@/server/actions/quote.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function QuotesPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;

  const [list, stats, customers] = await Promise.all([
    listQuotesAction(params),
    getQuoteStatsAction(),
    getCustomersForQuoteFilterAction(),
  ]);

  return (
    <QuotesPageClient
      user={user}
      quotes={list.quotes}
      customers={customers}
      stats={stats}
      total={list.total}
      page={list.page}
      totalPages={list.totalPages}
      filters={params}
    />
  );
}
