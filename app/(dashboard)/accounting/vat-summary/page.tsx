import { VatSummaryPageClient } from "@/components/accounting/vat-summary-page-client";
import { requireAuth } from "@/lib/auth";
import { getVatSummaryAction } from "@/server/actions/accounting-report.actions";

export default async function VatSummaryPage() {
  const user = await requireAuth();
  const summary = await getVatSummaryAction({});
  return <VatSummaryPageClient user={user} summary={summary} />;
}
