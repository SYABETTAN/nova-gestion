import { GeneralLedgerPageClient } from "@/components/accounting/general-ledger-page-client";
import { requireAuth } from "@/lib/auth";
import { getGeneralLedgerAction } from "@/server/actions/accounting-report.actions";

export default async function GeneralLedgerPage() {
  const user = await requireAuth();
  const rows = await getGeneralLedgerAction({});
  return <GeneralLedgerPageClient user={user} rows={rows} />;
}
