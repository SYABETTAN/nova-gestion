import { RemindersSageClient } from "@/components/reminders/reminders-sage-client";
import { requireAuth } from "@/lib/auth";
import {
  getCustomersForReminderFilterAction,
  listRemindersForSageGridAction,
} from "@/server/actions/reminder.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function RemindersPage({ searchParams }: PageProps) {
  try {
    const user = await requireAuth();
    const params = await searchParams;
    const [grid, customers] = await Promise.all([
      listRemindersForSageGridAction(params),
      getCustomersForReminderFilterAction(),
    ]);

    return (
      <RemindersSageClient
        user={user}
        rows={grid.rows}
        total={grid.total}
        page={grid.page}
        pageSize={grid.pageSize}
        totalPages={grid.totalPages}
        customers={customers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))}
        filters={params}
      />
    );
  } catch {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Impossible de charger les relances</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Vérifiez vos droits d&apos;accès et la connexion base de données, puis rechargez la page.
        </p>
      </div>
    );
  }
}
