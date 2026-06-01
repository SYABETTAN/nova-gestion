"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionGate } from "@/components/shared/permission-gate";
import { AccountingBalancedBadge, AccountingEntrySourceBadge, AccountingEntryStatusBadge } from "@/components/accounting/accounting-badges";
import { formatCurrency } from "@/lib/pricing";
import { isPositive } from "@/lib/money";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { formatDate, formatDateShort } from "@/lib/utils";
import {
  cancelAccountingEntryAction,
  duplicateAccountingEntryAction,
  validateAccountingEntryAction,
} from "@/server/actions/accounting-entry.actions";

type Entry = {
  id: string;
  entryNumber: string;
  entryDate: Date;
  label: string;
  reference: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceLabel: string | null;
  status: string;
  totalDebit: MoneyInput;
  totalCredit: MoneyInput;
  isBalanced: boolean;
  journal: { code: string; name: string };
  lines: {
    id: string;
    lineNumber: number;
    label: string;
    debit: MoneyInput;
    credit: MoneyInput;
    account: { accountNumber: string; name: string };
  }[];
};

function sourceLink(entry: Entry): string | null {
  if (!entry.sourceId) return null;
  if (entry.sourceType === "CUSTOMER_INVOICE") return `/invoices/${entry.sourceId}`;
  if (entry.sourceType === "CUSTOMER_PAYMENT") return `/payments/${entry.sourceId}`;
  if (entry.sourceType === "SUPPLIER_INVOICE") return `/supplier-invoices/${entry.sourceId}`;
  return null;
}

export function AccountingEntryDetailClient({ user, entry }: { user: SessionUser; entry: Entry }) {
  const router = useRouter();
  const link = sourceLink(entry);

  async function handleValidate() {
    const result = await validateAccountingEntryAction(entry.id);
    if (result.success) { toast.success("Écriture validée"); router.refresh(); }
    else toast.error(result.error ?? "Erreur");
  }

  async function handleDuplicate() {
    const result = await duplicateAccountingEntryAction(entry.id);
    if (result.success && result.entryId) router.push(`/accounting/entries/${result.entryId}`);
  }

  async function handleCancel() {
    const reason = prompt("Raison de l'annulation :");
    if (!reason) return;
    const result = await cancelAccountingEntryAction(entry.id, reason);
    if (result.success) { toast.success("Écriture annulée"); router.refresh(); }
    else toast.error(result.error ?? "Erreur");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{entry.entryNumber}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{entry.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <AccountingEntryStatusBadge status={entry.status} />
            <AccountingEntrySourceBadge sourceType={entry.sourceType} />
            <AccountingBalancedBadge isBalanced={entry.isBalanced} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {entry.status === "DRAFT" && (
            <PermissionGate user={user} permission="ACCOUNTING_UPDATE">
              <Button variant="outline" asChild><Link href={`/accounting/entries/${entry.id}/edit`}>Modifier</Link></Button>
            </PermissionGate>
          )}
          {entry.status === "DRAFT" && entry.isBalanced && (
            <PermissionGate user={user} permission="ACCOUNTING_VALIDATE">
              <Button onClick={handleValidate}>Valider</Button>
            </PermissionGate>
          )}
          <PermissionGate user={user} permission="ACCOUNTING_CREATE">
            <Button variant="outline" onClick={handleDuplicate}>Dupliquer</Button>
          </PermissionGate>
          {entry.status !== "CANCELLED" && (
            <PermissionGate user={user} permission="ACCOUNTING_CANCEL">
              <Button variant="destructive" onClick={handleCancel}>Annuler</Button>
            </PermissionGate>
          )}
        </div>
      </div>


      {entry.status === "VALIDATED" && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Cette écriture est validée et ne peut plus être modifiée.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Journal</CardTitle></CardHeader><CardContent>{entry.journal.code} — {entry.journal.name}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Date</CardTitle></CardHeader><CardContent>{formatDate(entry.entryDate)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Source</CardTitle></CardHeader><CardContent>
          {entry.sourceLabel ?? "—"}
          {link && <div className="mt-1"><Link href={link} className="text-sm text-blue-600 hover:underline">Voir le document source</Link></div>}
        </CardContent></Card>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Compte</th>
              <th className="px-4 py-2 text-left">Libellé</th>
              <th className="px-4 py-2 text-right">Débit</th>
              <th className="px-4 py-2 text-right">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line) => (
              <tr key={line.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{line.account.accountNumber} — {line.account.name}</td>
                <td className="px-4 py-2">{line.label}</td>
                <td className="px-4 py-2 text-right">{isPositive(line.debit) ? formatCurrency(line.debit) : "—"}</td>
                <td className="px-4 py-2 text-right">{isPositive(line.credit) ? formatCurrency(line.credit) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-slate-50 font-medium">
            <tr>
              <td colSpan={2} className="px-4 py-2 text-right">Totaux</td>
              <td className="px-4 py-2 text-right">{formatCurrency(entry.totalDebit)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(entry.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function AccountingSourceSection({
  user,
  sourceType,
  sourceId,
  entry,
}: {
  user: SessionUser;
  sourceType: "CUSTOMER_INVOICE" | "CUSTOMER_PAYMENT" | "SUPPLIER_INVOICE";
  sourceId: string;
  entry: { id: string; entryNumber: string; status: string; journal: { code: string }; entryDate: Date } | null;
}) {
  const router = useRouter();

  async function handleGenerate() {
    const actionMap = {
      CUSTOMER_INVOICE: () => import("@/server/actions/accounting-generator.actions").then((m) => m.generateAccountingEntryFromCustomerInvoiceAction(sourceId)),
      CUSTOMER_PAYMENT: () => import("@/server/actions/accounting-generator.actions").then((m) => m.generateAccountingEntryFromCustomerPaymentAction(sourceId)),
      SUPPLIER_INVOICE: () => import("@/server/actions/accounting-generator.actions").then((m) => m.generateAccountingEntryFromSupplierInvoiceAction(sourceId)),
    };
    const result = await actionMap[sourceType]();
    if (result.success) {
      toast.success(`Écriture ${result.entryNumber} générée`);
      router.refresh();
    } else if (result.entryId) {
      toast.info(result.error ?? "Écriture déjà existante");
      router.push(`/accounting/entries/${result.entryId}`);
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Comptabilité légère</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[var(--color-muted-foreground)]">Pré-comptabilité — à valider avec votre expert-comptable.</p>
        {entry ? (
          <div className="space-y-1 text-sm">
            <p>Écriture : <Link href={`/accounting/entries/${entry.id}`} className="font-mono text-blue-600 hover:underline">{entry.entryNumber}</Link></p>
            <p>Statut : {entry.status} — Journal {entry.journal.code} — {formatDateShort(entry.entryDate)}</p>
          </div>
        ) : (
          <PermissionGate user={user} permission="ACCOUNTING_CREATE">
            <Button size="sm" onClick={handleGenerate}>Générer l&apos;écriture comptable</Button>
          </PermissionGate>
        )}
      </CardContent>
    </Card>
  );
}
