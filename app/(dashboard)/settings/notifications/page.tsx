import { NotificationsSettingsClient } from "@/components/settings/notifications-settings-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { listNotificationPreferencesAction } from "@/server/actions/settings.actions";

export default async function NotificationsSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const preferences = await listNotificationPreferencesAction();

  return <NotificationsSettingsClient user={user} preferences={preferences} />;
}
