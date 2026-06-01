"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import type { SessionUser } from "@/lib/permissions";
import {
  createTaxRateAction,
  disableTaxRateAction,
  setDefaultTaxRateAction,
} from "@/server/actions/settings.actions";
import type { TaxRate } from "@prisma/client";
import { moneyToNumber } from "@/lib/money";

export function TaxesSettingsClient({
  user,
  taxRates,
}: {
  user: SessionUser;
  taxRates: TaxRate[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("20");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const result = await createTaxRateAction({ name, rate: Number(rate), type: "VAT", country: "FR" });
    if (result.success) {
      toast.success("Taux créé");
      setName("");
      router.refresh();
    }
  }

  return (
    <SettingsPageShell
      title="TVA et taxes"
      description="Configurez vos taux de TVA."
    >
      <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="TVA 20 %" required />
          </div>
          <div className="space-y-1">
            <Label>Taux (%)</Label>
            <Input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      </PermissionGate>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Taux</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Par défaut</TableHead>
            <TableHead>Actif</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {taxRates.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell>{moneyToNumber(t.rate)} %</TableCell>
              <TableCell>{t.type}</TableCell>
              <TableCell>{t.isDefault ? <Badge>Par défaut</Badge> : "—"}</TableCell>
              <TableCell>{t.isActive ? "Oui" : "Non"}</TableCell>
              <TableCell className="space-x-2">
                <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
                  {!t.isDefault && t.isActive ? (
                    <Button size="sm" variant="outline" onClick={async () => {
                      await setDefaultTaxRateAction(t.id);
                      toast.success("Taux par défaut défini");
                      router.refresh();
                    }}>Par défaut</Button>
                  ) : null}
                  {t.isActive ? (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await disableTaxRateAction(t.id);
                      toast.success("Taux désactivé");
                      router.refresh();
                    }}>Désactiver</Button>
                  ) : null}
                </PermissionGate>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsPageShell>
  );
}
