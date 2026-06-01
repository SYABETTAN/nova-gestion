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
  setDefaultCurrencyAction,
  updateCurrencyAction,
} from "@/server/actions/settings.actions";
import type { CurrencySetting } from "@prisma/client";
import { moneyToNumber } from "@/lib/money";

export function CurrenciesSettingsClient({
  user,
  currencies,
}: {
  user: SessionUser;
  currencies: CurrencySetting[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rate, setRate] = useState("");

  async function saveRate(id: string) {
    const result = await updateCurrencyAction(id, {
      exchangeRateToDefault: Number(rate),
    });
    if (result.success) {
      toast.success("Taux mis à jour");
      setEditingId(null);
      router.refresh();
    }
  }

  return (
    <SettingsPageShell
      title="Devises"
      description="Devises fictives avec taux statiques."
    >
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Taux de change — mettez à jour selon votre politique.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Symbole</TableHead>
            <TableHead>Taux vers devise par défaut</TableHead>
            <TableHead>Par défaut</TableHead>
            <TableHead>Actif</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {currencies.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.code}</TableCell>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.symbol}</TableCell>
              <TableCell>
                {editingId === c.id ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.0001"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="w-28"
                    />
                    <Button size="sm" onClick={() => saveRate(c.id)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  moneyToNumber(c.exchangeRateToDefault)
                )}
              </TableCell>
              <TableCell>{c.isDefault ? <Badge>Par défaut</Badge> : "—"}</TableCell>
              <TableCell>{c.isActive ? "Oui" : "Non"}</TableCell>
              <TableCell className="space-x-2">
                <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(c.id);
                      setRate(String(c.exchangeRateToDefault));
                    }}
                  >
                    Modifier taux
                  </Button>
                  {!c.isDefault ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await setDefaultCurrencyAction(c.id);
                        toast.success("Devise par défaut définie");
                        router.refresh();
                      }}
                    >
                      Par défaut
                    </Button>
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
