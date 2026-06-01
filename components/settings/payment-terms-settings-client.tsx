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
  createPaymentTermAction,
  disablePaymentTermAction,
  setDefaultPaymentTermAction,
} from "@/server/actions/settings.actions";
import type { PaymentTerm } from "@prisma/client";

export function PaymentTermsSettingsClient({
  user,
  terms,
}: {
  user: SessionUser;
  terms: PaymentTerm[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [days, setDays] = useState("30");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const result = await createPaymentTermAction({ name, days: Number(days) });
    if (result.success) {
      toast.success("Condition créée");
      setName("");
      router.refresh();
    }
  }

  return (
    <SettingsPageShell
      title="Conditions de paiement"
      description="Délais de règlement pour clients et fournisseurs."
    >
      <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <div className="space-y-1">
            <Label>Libellé</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Jours</Label>
            <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} required />
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      </PermissionGate>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Jours</TableHead>
            <TableHead>Par défaut</TableHead>
            <TableHead>Actif</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {terms.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell>{t.days}</TableCell>
              <TableCell>{t.isDefault ? <Badge>Par défaut</Badge> : "—"}</TableCell>
              <TableCell>{t.isActive ? "Oui" : "Non"}</TableCell>
              <TableCell className="space-x-2">
                <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
                  {!t.isDefault && t.isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await setDefaultPaymentTermAction(t.id);
                        toast.success("Condition par défaut définie");
                        router.refresh();
                      }}
                    >
                      Par défaut
                    </Button>
                  ) : null}
                  {t.isActive ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await disablePaymentTermAction(t.id);
                        toast.success("Condition désactivée");
                        router.refresh();
                      }}
                    >
                      Désactiver
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
