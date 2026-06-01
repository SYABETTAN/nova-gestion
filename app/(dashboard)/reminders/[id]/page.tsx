import { notFound } from "next/navigation";
import { ReminderDetailClient } from "@/components/reminders/reminder-detail-client";
import { requireAuth } from "@/lib/auth";
import { getReminderByIdAction } from "@/server/actions/reminder.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function ReminderDetailPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  const reminder = await getReminderByIdAction(id);
  if (!reminder) notFound();
  return <ReminderDetailClient reminder={reminder} />;
}
