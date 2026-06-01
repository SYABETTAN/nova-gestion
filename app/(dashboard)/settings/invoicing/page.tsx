import { InvoicingPreferencesClient } from "@/components/settings/invoicing-preferences-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  getInvoicingPreferenceAction,
  getSettingsFormOptionsAction,
} from "@/server/actions/settings.actions";

export default async function InvoicingSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const [preference, options] = await Promise.all([
    getInvoicingPreferenceAction(),
    getSettingsFormOptionsAction(),
  ]);

  return (
    <InvoicingPreferencesClient
      user={user}
      preference={preference}
      paymentTerms={options.paymentTerms}
      taxRates={options.taxRates}
    />
  );
}
