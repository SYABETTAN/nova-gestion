import { SupplierPreferencesClient } from "@/components/settings/supplier-preferences-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  getSettingsFormOptionsAction,
  getSupplierPreferenceAction,
} from "@/server/actions/settings.actions";

export default async function SupplierSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const [preference, options] = await Promise.all([
    getSupplierPreferenceAction(),
    getSettingsFormOptionsAction(),
  ]);

  return (
    <SupplierPreferencesClient
      user={user}
      preference={preference}
      paymentTerms={options.paymentTerms}
      taxRates={options.taxRates}
      expenseCategories={options.expenseCategories}
    />
  );
}
