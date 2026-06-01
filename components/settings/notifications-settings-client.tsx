"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { NOTIFICATION_TYPE_LABELS } from "@/lib/settings-utils";
import type { SessionUser } from "@/lib/permissions";
import { updateNotificationPreferenceAction } from "@/server/actions/settings.actions";
import type { NotificationPreference } from "@prisma/client";

export function NotificationsSettingsClient({
  user,
  preferences,
}: {
  user: SessionUser;
  preferences: NotificationPreference[];
}) {
  const router = useRouter();

  async function update(id: string, patch: Record<string, unknown>) {
    const result = await updateNotificationPreferenceAction(id, patch);
    if (result.success) {
      toast.success("Préférence mise à jour");
      router.refresh();
    }
  }

  return (
    <SettingsPageShell
      title="Notifications"
      description="Canaux de notification par type d'événement."
    >
      <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Configurez les notifications par canal.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Événement</TableHead>
            <TableHead>Activé</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Fréquence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preferences.map((pref) => (
            <TableRow key={pref.id}>
              <TableCell className="font-medium">
                {NOTIFICATION_TYPE_LABELS[pref.type] ?? pref.type}
              </TableCell>
              <TableCell>
                <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
                  <input
                    type="checkbox"
                    checked={pref.enabled}
                    onChange={(e) =>
                      update(pref.id, {
                        enabled: e.target.checked,
                        channel: pref.channel,
                        frequency: pref.frequency,
                      })
                    }
                    className="h-4 w-4"
                  />
                </PermissionGate>
              </TableCell>
              <TableCell>
                <Select
                  value={pref.channel}
                  onValueChange={(v) => update(pref.id, { enabled: pref.enabled, channel: v, frequency: pref.frequency })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_APP">In-app</SelectItem>
                    <SelectItem value="EMAIL_SIMULATED">Email (non configuré)</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={pref.frequency}
                  onValueChange={(v) => update(pref.id, { enabled: pref.enabled, channel: pref.channel, frequency: v })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMMEDIATE">Immédiat</SelectItem>
                    <SelectItem value="DAILY">Quotidien</SelectItem>
                    <SelectItem value="WEEKLY">Hebdomadaire</SelectItem>
                    <SelectItem value="NEVER">Jamais</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsPageShell>
  );
}
