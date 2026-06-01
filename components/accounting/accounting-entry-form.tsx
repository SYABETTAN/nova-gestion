"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { calculateAccountingEntryTotals } from "@/lib/accounting-calculations";
import { formatCurrency } from "@/lib/pricing";
import type { MoneyInput } from "@/lib/money";
import {
  createAccountingEntryAction,
  updateAccountingEntryAction,
} from "@/server/actions/accounting-entry.actions";
import { moneyToNumber } from "@/lib/money";

type LineState = {
  accountId: string;
  label: string;
  debit: number;
  credit: number;
};

type Props = {
  mode: "create" | "edit";
  entryId?: string;
  journals: { id: string; code: string; name: string }[];
  accounts: { id: string; accountNumber: string; name: string }[];
  initial?: {
    journalId: string;
    entryDate: string;
    label: string;
    reference?: string | null;
    lines: { accountId: string; label: string; debit: MoneyInput; credit: MoneyInput }[];
  };
};

export function AccountingEntryForm({ mode, entryId, journals, accounts, initial }: Props) {
  const router = useRouter();
  const [journalId, setJournalId] = useState(initial?.journalId ?? journals[0]?.id ?? "");
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState(initial?.label ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [lines, setLines] = useState<LineState[]>(
    initial?.lines?.length
      ? initial.lines.map((l) => ({
          accountId: l.accountId,
          label: l.label,
          debit: moneyToNumber(l.debit),
          credit: moneyToNumber(l.credit),
        }))
      : [
          { accountId: accounts[0]?.id ?? "", label: "", debit: 0, credit: 0 },
          { accountId: accounts[1]?.id ?? accounts[0]?.id ?? "", label: "", debit: 0, credit: 0 },
        ],
  );
  const [loading, setLoading] = useState(false);

  const totals = useMemo(
    () =>
      calculateAccountingEntryTotals(
        lines.map((l, i) => ({
          accountId: l.accountId,
          lineNumber: i,
          label: l.label || label || "Ligne",
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      ),
    [lines, label],
  );

  const gap = Math.abs(totals.totalDebit - totals.totalCredit);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { accountId: accounts[0]?.id ?? "", label: "", debit: 0, credit: 0 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(validate: boolean) {
    setLoading(true);
    const formData = new FormData();
    formData.set("journalId", journalId);
    formData.set("entryDate", entryDate);
    formData.set("label", label);
    formData.set("reference", reference);
    formData.set(
      "lines",
      JSON.stringify(
        lines.map((l, i) => ({
          accountId: l.accountId,
          lineNumber: i,
          label: l.label || label,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      ),
    );

    const result =
      mode === "create"
        ? await createAccountingEntryAction(formData, validate)
        : await updateAccountingEntryAction(entryId!, formData, validate);

    setLoading(false);
    if (result.success) {
      toast.success(validate ? "Écriture validée" : "Brouillon enregistré");
      const targetId = mode === "edit" ? entryId! : ("entryId" in result ? result.entryId : undefined);
      if (targetId) router.push(`/accounting/entries/${targetId}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{mode === "create" ? "Nouvelle écriture OD" : "Modifier l'écriture"}</h1>
      </div>

      <div className="grid gap-4 rounded-lg border bg-white p-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Journal</Label>
          <Select value={journalId} onValueChange={setJournalId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {journals.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.code} — {j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date d&apos;écriture</Label>
          <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Libellé</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Référence</Label>
          <Textarea value={reference} onChange={(e) => setReference(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Lignes débit / crédit</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>Ajouter une ligne</Button>
        </div>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded border p-3 md:grid-cols-6">
            <Select value={line.accountId} onValueChange={(v) => updateLine(index, { accountId: v })}>
              <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Compte" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.accountNumber} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Libellé ligne" value={line.label} onChange={(e) => updateLine(index, { label: e.target.value })} className="md:col-span-2" />
            <Input type="number" step="0.01" placeholder="Débit" value={line.debit || ""} onChange={(e) => updateLine(index, { debit: Number(e.target.value), credit: 0 })} />
            <div className="flex gap-2">
              <Input type="number" step="0.01" placeholder="Crédit" value={line.credit || ""} onChange={(e) => updateLine(index, { credit: Number(e.target.value), debit: 0 })} />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)}>×</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-slate-50 p-4">
        <div className="grid gap-2 sm:grid-cols-4 text-sm">
          <p>Total débit : <strong>{formatCurrency(totals.totalDebit)}</strong></p>
          <p>Total crédit : <strong>{formatCurrency(totals.totalCredit)}</strong></p>
          <p>Écart : <strong className={gap > 0 ? "text-red-600" : "text-green-700"}>{formatCurrency(gap)}</strong></p>
          <p>Équilibrée : <strong>{totals.isBalanced ? "Oui" : "Non"}</strong></p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={loading} onClick={() => submit(false)}>Enregistrer en brouillon</Button>
        <Button disabled={loading || !totals.isBalanced} onClick={() => submit(true)}>Valider</Button>
        <Button variant="outline" onClick={() => router.back()}>Annuler</Button>
      </div>
    </div>
  );
}
