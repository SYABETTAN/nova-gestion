import { AccountingEntriesPageClient } from "@/components/accounting/accounting-entries-page-client";
import { requireAuth } from "@/lib/auth";
import { listAccountingJournalsAction } from "@/server/actions/accounting-journal.actions";
import { listAccountingEntriesAction } from "@/server/actions/accounting-entry.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AccountingEntriesPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const cleanParams = { ...params };
  if (cleanParams.status === "all") delete cleanParams.status;
  if (cleanParams.journalId === "all") delete cleanParams.journalId;
  if (cleanParams.sourceType === "all") delete cleanParams.sourceType;

  const [list, journals] = await Promise.all([
    listAccountingEntriesAction(cleanParams),
    listAccountingJournalsAction(),
  ]);

  return (
    <AccountingEntriesPageClient
      user={user}
      entries={list.entries}
      total={list.total}
      page={list.page}
      pageSize={list.pageSize}
      journals={journals}
      filters={params}
    />
  );
}
