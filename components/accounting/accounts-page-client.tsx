"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ACCOUNTING_ACCOUNT_TYPE_LABELS } from "@/lib/accounting-mapping";
import type { SessionUser } from "@/lib/permissions";
import {
  createAccountingAccountAction,
  disableAccountingAccountAction,
  exportAccountingAccountsCsvAction,
} from "@/server/actions/accounting-account.actions";

type Account = {
  id: string;
  accountNumber: string;
  name: string;
  type: string;
  category: string;
  isActive: boolean;
  isSystem: boolean;
};

export function AccountsPageClient({ user, accounts }: { user: SessionUser; accounts: Account[] }) {
  const router = useRouter();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await createAccountingAccountAction(formData);
    if (result.success) { toast.success("Compte créé"); router.refresh(); (e.target as HTMLFormElement).reset(); }
    else toast.error(result.error ?? "Erreur");
  }

  async function handleDisable(id: string) {
    if (!confirm("Désactiver ce compte ?")) return;
    const result = await disableAccountingAccountAction(id);
    if (result.success) { toast.success("Compte désactivé"); router.refresh(); }
  }

  async function handleExport() {
    const result = await exportAccountingAccountsCsvAction();
    if (result.success && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "plan-comptable.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Plan comptable</h1>
        <PermissionGate user={user} permission="ACCOUNTING_EXPORT">
          <Button variant="outline" onClick={handleExport}>Exporter CSV</Button>
        </PermissionGate>
      </div>

      <PermissionGate user={user} permission="ACCOUNTING_SETTINGS_UPDATE">
        <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-5">
          <Input name="accountNumber" placeholder="Numéro (ex: 622600)" required />
          <Input name="name" placeholder="Nom du compte" required className="md:col-span-2" />
          <Input name="type" placeholder="Type (EXPENSE...)" defaultValue="EXPENSE" required />
          <Input name="category" placeholder="Catégorie" defaultValue="GENERAL_EXPENSE" required />
          <Button type="submit" className="md:col-span-5 md:w-fit">Créer un compte</Button>
        </form>
      </PermissionGate>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Numéro</th>
              <th className="px-4 py-2 text-left">Nom</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Statut</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono">{a.accountNumber}</td>
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2">{ACCOUNTING_ACCOUNT_TYPE_LABELS[a.type] ?? a.type}</td>
                <td className="px-4 py-2">{a.isActive ? "Actif" : "Inactif"}{a.isSystem ? " (système)" : ""}</td>
                <td className="px-4 py-2 text-right">
                  {!a.isSystem && a.isActive && (
                    <PermissionGate user={user} permission="ACCOUNTING_SETTINGS_UPDATE">
                      <Button variant="ghost" size="sm" onClick={() => handleDisable(a.id)}>Désactiver</Button>
                    </PermissionGate>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
