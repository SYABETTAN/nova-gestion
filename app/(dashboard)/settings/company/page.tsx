import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { getCurrentDemoOrganization } from "@/lib/organization";
import { resolveOrganizationDisplayName } from "@/lib/organization-display";
import { requireAuth } from "@/lib/auth";

export default async function CompanySettingsPage() {
  const user = await requireAuth();
  const { organization } = await getCurrentDemoOrganization();
  const organizationDisplayName = resolveOrganizationDisplayName(
    organization.name,
    organization.slug,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres entreprise</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Consultez et modifiez les informations de {organizationDisplayName}
        </p>
      </div>
      <CompanySettingsForm organization={organization} user={user} />
    </div>
  );
}
