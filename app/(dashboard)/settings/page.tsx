import { SettingsCenter } from "@/components/settings/settings-center";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getSettingsCompletionStatus } from "@/lib/settings";

export default async function SettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const completion = await getSettingsCompletionStatus(user.organizationId);

  return <SettingsCenter completion={completion} />;
}
