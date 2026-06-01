import { CustomFieldsSettingsClient } from "@/components/settings/custom-fields-settings-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { listCustomFieldsAction } from "@/server/actions/settings.actions";

export default async function CustomFieldsSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const fields = await listCustomFieldsAction();

  return <CustomFieldsSettingsClient user={user} fields={fields} />;
}
