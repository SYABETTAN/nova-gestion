"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { ACCOUNTING_MAPPING_TYPE_LABELS } from "@/lib/settings-utils";

type MappingRow = {
  id: string;
  type: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
  account?: { accountNumber: string; name: string } | null;
};

export function AccountingMappingSettingsClient({ mappings }: { mappings: MappingRow[] }) {
  return (
    <SettingsPageShell
      title="Mapping comptable"
      description="Association des types d'opération aux comptes du plan comptable."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Compte</TableHead>
            <TableHead>Par défaut</TableHead>
            <TableHead>Actif</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{ACCOUNTING_MAPPING_TYPE_LABELS[m.type] ?? m.type}</TableCell>
              <TableCell className="font-medium">{m.label}</TableCell>
              <TableCell>
                {m.account ? `${m.account.accountNumber} — ${m.account.name}` : "—"}
              </TableCell>
              <TableCell>{m.isDefault ? <Badge>Par défaut</Badge> : "—"}</TableCell>
              <TableCell>{m.isActive ? "Oui" : "Non"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsPageShell>
  );
}
