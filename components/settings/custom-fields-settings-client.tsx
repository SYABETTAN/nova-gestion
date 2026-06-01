"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CUSTOM_FIELD_ENTITY_LABELS } from "@/lib/settings-utils";
import type { SessionUser } from "@/lib/permissions";
import {
  createCustomFieldAction,
  disableCustomFieldAction,
} from "@/server/actions/settings.actions";
import type { CustomFieldDefinition } from "@prisma/client";

export function CustomFieldsSettingsClient({
  user,
  fields,
}: {
  user: SessionUser;
  fields: CustomFieldDefinition[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [entityType, setEntityType] = useState("CUSTOMER");
  const [fieldType, setFieldType] = useState("TEXT");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const result = await createCustomFieldAction({ label, entityType, fieldType });
    if (result.success) {
      toast.success("Champ créé");
      setLabel("");
      router.refresh();
    }
  }

  return (
    <SettingsPageShell
      title="Champs personnalisés"
      description="Définitions simples — saisie avancée à venir sur les fiches."
    >
      <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <div className="space-y-1">
            <Label>Libellé</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Entité</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CUSTOM_FIELD_ENTITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Texte</SelectItem>
                <SelectItem value="NUMBER">Nombre</SelectItem>
                <SelectItem value="DATE">Date</SelectItem>
                <SelectItem value="BOOLEAN">Oui/non</SelectItem>
                <SelectItem value="SELECT">Liste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      </PermissionGate>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entité</TableHead>
            <TableHead>Clé</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Actif</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((f) => (
            <TableRow key={f.id}>
              <TableCell>{CUSTOM_FIELD_ENTITY_LABELS[f.entityType] ?? f.entityType}</TableCell>
              <TableCell className="font-mono text-xs">{f.key}</TableCell>
              <TableCell>{f.label}</TableCell>
              <TableCell>{f.fieldType}</TableCell>
              <TableCell>{f.isActive ? <Badge variant="success">Oui</Badge> : "Non"}</TableCell>
              <TableCell>
                {f.isActive ? (
                  <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await disableCustomFieldAction(f.id);
                        toast.success("Champ désactivé");
                        router.refresh();
                      }}
                    >
                      Désactiver
                    </Button>
                  </PermissionGate>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsPageShell>
  );
}
