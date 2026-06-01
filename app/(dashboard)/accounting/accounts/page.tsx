import { AccountsPageClient } from "@/components/accounting/accounts-page-client";
import { requireAuth } from "@/lib/auth";
import { listAccountingAccountsAction } from "@/server/actions/accounting-account.actions";

export default async function AccountingAccountsPage() {
  const user = await requireAuth();
  const accounts = await listAccountingAccountsAction();
  return <AccountsPageClient user={user} accounts={accounts} />;
}
