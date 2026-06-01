import { CommercialPreferencesClient } from "@/components/settings/commercial-preferences-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  getCommercialPreferenceAction,
  getSettingsFormOptionsAction,
} from "@/server/actions/settings.actions";

export default async function CommercialSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const [preference, options] = await Promise.all([
    getCommercialPreferenceAction(),
    getSettingsFormOptionsAction(),
  ]);

  return (
    <CommercialPreferencesClient
      user={user}
      preference={preference}
      paymentTerms={options.paymentTerms}
      taxRates={options.taxRates}
    />
  );
}
