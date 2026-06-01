import { ReminderHistoryPageClient } from "@/components/reminders/reminder-history-page-client";
import { requireAuth } from "@/lib/auth";
import { listReminderHistoryAction } from "@/server/actions/reminder.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ReminderHistoryPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const list = await listReminderHistoryAction(params);
  return (
    <ReminderHistoryPageClient
      user={user}
      reminders={list.reminders}
      total={list.total}
      page={list.page}
      totalPages={list.totalPages}
    />
  );
}
