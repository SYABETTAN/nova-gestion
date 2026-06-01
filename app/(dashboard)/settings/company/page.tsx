import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { getCurrentDemoOrganization } from "@/lib/organization";
import { requireAuth } from "@/lib/auth";

export default async function CompanySettingsPage() {
  const user = await requireAuth();
  const { organization } = await getCurrentDemoOrganization();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres entreprise</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Consultez et modifiez les informations de {organization.name}
        </p>
      </div>
      <CompanySettingsForm organization={organization} user={user} />
    </div>
  );
}
