import { FeatureFlagsSettingsClient } from "@/components/settings/feature-flags-settings-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { listFeatureFlagsAction } from "@/server/actions/settings.actions";

export default async function FeaturesSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const flags = await listFeatureFlagsAction();

  return <FeatureFlagsSettingsClient user={user} flags={flags} />;
}
