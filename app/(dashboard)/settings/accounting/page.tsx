import { AccountingPreferencesClient } from "@/components/settings/accounting-preferences-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  getAccountingPreferenceAction,
  getSettingsFormOptionsAction,
} from "@/server/actions/settings.actions";

export default async function AccountingSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const [preference, options] = await Promise.all([
    getAccountingPreferenceAction(),
    getSettingsFormOptionsAction(),
  ]);

  return (
    <AccountingPreferencesClient
      user={user}
      preference={preference}
      journals={options.journals}
    />
  );
}
