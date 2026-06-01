import { AccountingEntryForm } from "@/components/accounting/accounting-entry-form";
import { requireAuth } from "@/lib/auth";
import { getAccountingFormDataAction } from "@/server/actions/accounting-entry.actions";

export default async function NewAccountingEntryPage() {
  await requireAuth();
  const { accounts, journals } = await getAccountingFormDataAction();
  return <AccountingEntryForm mode="create" accounts={accounts} journals={journals} />;
}
