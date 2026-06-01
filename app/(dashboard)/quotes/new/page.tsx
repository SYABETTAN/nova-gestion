import { QuoteForm } from "@/components/quotes/quote-form";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { getQuoteFormDataAction } from "@/server/actions/quote.actions";
import { getCommercialPreferenceAction } from "@/server/actions/settings.actions";

export default async function NewQuotePage() {
  await requireAuth();
  const [{ customers, items, organization }, commercial] = await Promise.all([
    getQuoteFormDataAction(),
    getCommercialPreferenceAction(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Nouveau devis</h1>
        </div>
        <p className="text-[var(--color-muted-foreground)]">Créez un devis commercial pour votre client</p>
      </div>
      <QuoteForm
        mode="create"
        customers={customers}
        items={items}
        organization={organization}
        commercialDefaults={commercial}
      />
    </div>
  );
}
