import { TaxesSettingsClient } from "@/components/settings/taxes-settings-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { listTaxRatesAction } from "@/server/actions/settings.actions";

export default async function TaxesSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const taxRates = await listTaxRatesAction();

  return <TaxesSettingsClient user={user} taxRates={taxRates} />;
}
