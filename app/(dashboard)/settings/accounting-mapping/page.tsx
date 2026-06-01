import { AccountingMappingSettingsClient } from "@/components/settings/accounting-mapping-settings-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { listAccountingMappingsAction } from "@/server/actions/settings.actions";

export default async function AccountingMappingSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const mappings = await listAccountingMappingsAction();

  return <AccountingMappingSettingsClient mappings={mappings} />;
}
