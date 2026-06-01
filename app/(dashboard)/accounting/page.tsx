import { AccountingDashboardClient } from "@/components/accounting/accounting-dashboard-client";
import { requireAuth } from "@/lib/auth";
import { getAccountingDashboardStatsAction } from "@/server/actions/accounting-entry.actions";

export default async function AccountingPage() {
  const user = await requireAuth();
  const stats = await getAccountingDashboardStatsAction();
  return <AccountingDashboardClient user={user} stats={stats} />;
}
