import { RemindersPageClient } from "@/components/reminders/reminders-page-client";
import { requireAuth } from "@/lib/auth";
import {
  getCustomersForReminderFilterAction,
  getReminderStatsAction,
  listInvoicesToRemindAction,
} from "@/server/actions/reminder.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function RemindersPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const [list, stats, customers] = await Promise.all([
    listInvoicesToRemindAction(params),
    getReminderStatsAction(),
    getCustomersForReminderFilterAction(),
  ]);
  return (
    <RemindersPageClient
      user={user}
      invoices={list.invoices}
      customers={customers}
      stats={stats}
      total={list.total}
      page={list.page}
      totalPages={list.totalPages}
      filters={params}
    />
  );
}
