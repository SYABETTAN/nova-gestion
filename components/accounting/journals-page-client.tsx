"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ACCOUNTING_JOURNAL_TYPE_LABELS } from "@/lib/accounting-mapping";
import type { SessionUser } from "@/lib/permissions";
import {
  createAccountingJournalAction,
  disableAccountingJournalAction,
} from "@/server/actions/accounting-journal.actions";

type Journal = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  isSystem: boolean;
  _count: { entries: number };
};

export function JournalsPageClient({ user, journals }: { user: SessionUser; journals: Journal[] }) {
  const router = useRouter();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await createAccountingJournalAction(formData);
    if (result.success) { toast.success("Journal créé"); router.refresh(); (e.target as HTMLFormElement).reset(); }
    else toast.error(result.error ?? "Erreur");
  }

  async function handleDisable(id: string) {
    if (!confirm("Désactiver ce journal ?")) return;
    const result = await disableAccountingJournalAction(id);
    if (result.success) { toast.success("Journal désactivé"); router.refresh(); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Journaux comptables</h1>

      <PermissionGate user={user} permission="ACCOUNTING_SETTINGS_UPDATE">
        <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
          <Input name="code" placeholder="Code (ex: OD)" required />
          <Input name="name" placeholder="Nom du journal" required className="md:col-span-2" />
          <Input name="type" placeholder="Type (MISCELLANEOUS...)" defaultValue="MISCELLANEOUS" required />
          <Button type="submit" className="md:col-span-4 md:w-fit">Créer un journal</Button>
        </form>
      </PermissionGate>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Nom</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Écritures</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((j) => (
              <tr key={j.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono">{j.code}</td>
                <td className="px-4 py-2">{j.name}</td>
                <td className="px-4 py-2">{ACCOUNTING_JOURNAL_TYPE_LABELS[j.type] ?? j.type}</td>
                <td className="px-4 py-2">{j._count.entries}</td>
                <td className="px-4 py-2 text-right">
                  {!j.isSystem && j.isActive && (
                    <PermissionGate user={user} permission="ACCOUNTING_SETTINGS_UPDATE">
                      <Button variant="ghost" size="sm" onClick={() => handleDisable(j.id)}>Désactiver</Button>
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
