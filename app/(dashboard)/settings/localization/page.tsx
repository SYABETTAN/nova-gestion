import { LocalizationSettingsClient } from "@/components/settings/localization-settings-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getLocalizationAction } from "@/server/actions/settings.actions";

export default async function LocalizationSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const localization = await getLocalizationAction();

  return <LocalizationSettingsClient user={user} localization={localization} />;
}
