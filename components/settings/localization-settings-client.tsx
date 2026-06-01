"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionGate } from "@/components/shared/permission-gate";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { previewLocalization } from "@/lib/localization";
import type { SessionUser } from "@/lib/permissions";
import { updateLocalizationAction } from "@/server/actions/settings.actions";
import type { LocalizationSetting } from "@prisma/client";

export function LocalizationSettingsClient({
  user,
  localization,
}: {
  user: SessionUser;
  localization: LocalizationSetting;
}) {
  const router = useRouter();
  const preview = previewLocalization(localization.locale, localization.dateFormat);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await updateLocalizationAction({
      locale: formData.get("locale"),
      timezone: formData.get("timezone"),
      dateFormat: formData.get("dateFormat"),
      numberFormat: formData.get("numberFormat"),
      currencyFormat: formData.get("currencyFormat"),
      firstDayOfWeek: formData.get("firstDayOfWeek"),
    });
    if (result.success) {
      toast.success("Localisation enregistrée");
      router.refresh();
    }
  }

  return (
    <SettingsPageShell
      title="Langues et formats"
      description="Préférences de formatage régionales."
    >
      <form onSubmit={handleSubmit} className="grid max-w-2xl gap-4">
        {(
          [
            ["locale", "Langue (locale)"],
            ["timezone", "Fuseau horaire"],
            ["dateFormat", "Format de date"],
            ["numberFormat", "Format numérique"],
            ["currencyFormat", "Format devise"],
            ["firstDayOfWeek", "Premier jour de la semaine"],
          ] as const
        ).map(([name, label]) => (
          <div key={name} className="space-y-1">
            <Label>{label}</Label>
            <Input name={name} defaultValue={localization[name]} required />
          </div>
        ))}
        <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
          <Button type="submit">Enregistrer</Button>
        </PermissionGate>
      </form>

      <div className="rounded-lg border bg-slate-50 p-4 text-sm">
        <p className="font-medium">Aperçu</p>
        <p>Date : {preview.date}</p>
        <p>Montant : {preview.amount}</p>
        <p>Pourcentage : {preview.percent}</p>
      </div>
    </SettingsPageShell>
  );
}
