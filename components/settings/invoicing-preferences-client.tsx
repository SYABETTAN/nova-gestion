"use client";

import { PreferencesFormClient } from "@/components/settings/preferences-form-client";
import { parseInvoicingPreferenceForm } from "@/lib/settings-form";
import type { SessionUser } from "@/lib/permissions";
import { updateInvoicingPreferenceAction } from "@/server/actions/settings.actions";
import type { InvoicingPreference, PaymentTerm, TaxRate } from "@prisma/client";

export function InvoicingPreferencesClient({
  user,
  preference,
  paymentTerms,
  taxRates,
}: {
  user: SessionUser;
  preference: InvoicingPreference;
  paymentTerms: PaymentTerm[];
  taxRates: TaxRate[];
}) {
  return (
    <PreferencesFormClient
      user={user}
      title="Préférences facturation"
      description="Factures clients et avoirs."
      warning="Vérifiez les mentions légales sur vos documents."
      values={preference as unknown as Record<string, unknown>}
      fields={[
        {
          type: "select",
          name: "defaultInvoicePaymentTermId",
          label: "Condition de paiement par défaut",
          options: paymentTerms.map((t) => ({ value: t.id, label: t.name })),
        },
        {
          type: "select",
          name: "defaultInvoiceTaxRateId",
          label: "TVA par défaut",
          options: taxRates.map((t) => ({ value: t.id, label: `${t.name} (${t.rate} %)` })),
        },
        { type: "textarea", name: "defaultInvoiceIntroduction", label: "Introduction facture" },
        { type: "textarea", name: "defaultInvoiceFooter", label: "Pied de page facture" },
        { type: "textarea", name: "defaultCreditNoteFooter", label: "Pied de page avoir" },
        { type: "checkbox", name: "lockInvoiceAfterValidation", label: "Verrouiller après validation" },
        { type: "checkbox", name: "allowInvoiceFromQuote", label: "Créer facture depuis devis" },
        {
          type: "checkbox",
          name: "allowDraftInvoiceDeletionSandbox",
          label: "Autoriser suppression brouillon",
        },
        { type: "checkbox", name: "showSandboxLegalNotice", label: "Afficher mention brouillon sur documents" },
      ]}
      onSave={async (formData) => updateInvoicingPreferenceAction(parseInvoicingPreferenceForm(formData))}
    />
  );
}
