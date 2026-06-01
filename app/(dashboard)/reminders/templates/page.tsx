import { ReminderTemplatesPageClient } from "@/components/reminders/reminder-templates-page-client";
import { requireAuth } from "@/lib/auth";
import { listReminderTemplatesAction } from "@/server/actions/reminder-template.actions";

export default async function ReminderTemplatesPage() {
  const user = await requireAuth();
  const templates = await listReminderTemplatesAction();
  return <ReminderTemplatesPageClient user={user} templates={templates} />;
}
