import { TrialBalancePageClient } from "@/components/accounting/trial-balance-page-client";
import { requireAuth } from "@/lib/auth";
import { getTrialBalanceAction } from "@/server/actions/accounting-report.actions";

export default async function TrialBalancePage() {
  const user = await requireAuth();
  const rows = await getTrialBalanceAction({});
  return <TrialBalancePageClient user={user} rows={rows} />;
}
