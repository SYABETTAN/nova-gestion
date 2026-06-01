import { notFound } from "next/navigation";
import { AccountingEntryDetailClient } from "@/components/accounting/accounting-entry-detail-client";
import { requireAuth } from "@/lib/auth";
import { getAccountingEntryByIdAction } from "@/server/actions/accounting-entry.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function AccountingEntryDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const entry = await getAccountingEntryByIdAction(id);
  if (!entry) notFound();
  return <AccountingEntryDetailClient user={user} entry={entry} />;
}
