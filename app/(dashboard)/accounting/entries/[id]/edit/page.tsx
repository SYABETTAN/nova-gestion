import { notFound } from "next/navigation";
import { AccountingEntryForm } from "@/components/accounting/accounting-entry-form";
import { requireAuth } from "@/lib/auth";
import { moneyToNumber } from "@/lib/money";
import { getAccountingEntryByIdAction, getAccountingFormDataAction } from "@/server/actions/accounting-entry.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditAccountingEntryPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  const [entry, formData] = await Promise.all([
    getAccountingEntryByIdAction(id),
    getAccountingFormDataAction(),
  ]);
  if (!entry) notFound();
  if (entry.status !== "DRAFT") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Cette écriture est validée et ne peut plus être modifiée.
        </p>
      </div>
    );
  }

  return (
    <AccountingEntryForm
      mode="edit"
      entryId={entry.id}
      accounts={formData.accounts}
      journals={formData.journals}
      initial={{
        journalId: entry.journalId,
        entryDate: entry.entryDate.toISOString().slice(0, 10),
        label: entry.label,
        reference: entry.reference,
        lines: entry.lines.map((l) => ({
          accountId: l.accountId,
          label: l.label,
          debit: moneyToNumber(l.debit),
          credit: moneyToNumber(l.credit),
        })),
      }}
    />
  );
}
