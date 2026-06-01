"use client";

import { PreferencesFormClient } from "@/components/settings/preferences-form-client";
import {
  parseCommercialPreferenceForm,
} from "@/lib/settings-form";
import type { SessionUser } from "@/lib/permissions";
import { updateCommercialPreferenceAction } from "@/server/actions/settings.actions";
import type { CommercialPreference, PaymentTerm, TaxRate } from "@prisma/client";

export function CommercialPreferencesClient({
  user,
  preference,
  paymentTerms,
  taxRates,
}: {
  user: SessionUser;
  preference: CommercialPreference;
  paymentTerms: PaymentTerm[];
  taxRates: TaxRate[];
}) {
  return (
    <PreferencesFormClient
      user={user}
      title="Préférences commerciales"
      description="Valeurs par défaut pour les devis."
      values={preference as unknown as Record<string, unknown>}
      fields={[
        { type: "number", name: "defaultQuoteValidityDays", label: "Validité devis (jours)" },
        { type: "textarea", name: "defaultQuoteIntroduction", label: "Introduction devis" },
        { type: "textarea", name: "defaultQuoteFooter", label: "Pied de page devis" },
        {
          type: "select",
          name: "defaultCustomerPaymentTermId",
          label: "Condition de paiement par défaut",
          options: paymentTerms.map((t) => ({ value: t.id, label: t.name })),
        },
        {
          type: "select",
          name: "defaultCustomerTaxRateId",
          label: "TVA par défaut",
          options: taxRates.map((t) => ({ value: t.id, label: `${t.name} (${t.rate} %)` })),
        },
        { type: "checkbox", name: "allowQuoteDiscounts", label: "Autoriser les remises" },
        { type: "checkbox", name: "allowQuoteFreeTextLines", label: "Autoriser les lignes libres" },
        { type: "checkbox", name: "requireCustomerForQuote", label: "Client obligatoire" },
      ]}
      onSave={async (formData) => updateCommercialPreferenceAction(parseCommercialPreferenceForm(formData))}
    />
  );
}
