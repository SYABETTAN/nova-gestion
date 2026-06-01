import { PaymentTermsSettingsClient } from "@/components/settings/payment-terms-settings-client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { listPaymentTermsAction } from "@/server/actions/settings.actions";

export default async function PaymentTermsSettingsPage() {
  const user = await requireAuth();
  requirePermission(user, "ADVANCED_SETTINGS_READ");
  const terms = await listPaymentTermsAction();

  return <PaymentTermsSettingsClient user={user} terms={terms} />;
}
