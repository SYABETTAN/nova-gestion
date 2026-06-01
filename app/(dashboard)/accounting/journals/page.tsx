import { JournalsPageClient } from "@/components/accounting/journals-page-client";
import { requireAuth } from "@/lib/auth";
import { listAccountingJournalsAction } from "@/server/actions/accounting-journal.actions";

export default async function AccountingJournalsPage() {
  const user = await requireAuth();
  const journals = await listAccountingJournalsAction();
  return <JournalsPageClient user={user} journals={journals} />;
}
