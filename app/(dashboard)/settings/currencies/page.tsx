import { CurrenciesSettingsClient } from "@/components/settings/currencies-settings-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { listCurrenciesAction } from "@/server/actions/settings.actions";

export default async function CurrenciesSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const currencies = await listCurrenciesAction();

  return <CurrenciesSettingsClient user={user} currencies={currencies} />;
}
