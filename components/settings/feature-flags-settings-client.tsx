"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { canDisableFeatureFlag } from "@/lib/feature-flags";
import type { SessionUser } from "@/lib/permissions";
import { updateFeatureFlagAction } from "@/server/actions/settings.actions";
import type { FeatureFlag } from "@prisma/client";

export function FeatureFlagsSettingsClient({
  user,
  flags,
}: {
  user: SessionUser;
  flags: FeatureFlag[];
}) {
  const router = useRouter();

  async function toggle(id: string, enabled: boolean) {
    const result = await updateFeatureFlagAction(id, { enabled });
    if (result.success) {
      toast.success(enabled ? "Module activé" : "Module désactivé");
      router.refresh();
    }
  }

  return (
    <SettingsPageShell
      title="Modules"
      description="Activez ou désactivez les modules de démonstration."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Actif</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flags.map((flag) => (
            <TableRow key={flag.id}>
              <TableCell className="font-medium">{flag.name}</TableCell>
              <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                {flag.description}
              </TableCell>
              <TableCell>
                {flag.isSystem ? <Badge variant="secondary">Système</Badge> : "—"}
              </TableCell>
              <TableCell>
                <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    disabled={!canDisableFeatureFlag(flag.key)}
                    onChange={(e) => toggle(flag.id, e.target.checked)}
                    className="h-4 w-4"
                  />
                </PermissionGate>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsPageShell>
  );
}
