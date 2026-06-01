"use client";

import { PreferencesFormClient } from "@/components/settings/preferences-form-client";
import { parseSupplierPreferenceForm } from "@/lib/settings-form";
import type { SessionUser } from "@/lib/permissions";
import { updateSupplierPreferenceAction } from "@/server/actions/settings.actions";
import type { ExpenseCategory, PaymentTerm, SupplierPreference, TaxRate } from "@prisma/client";

export function SupplierPreferencesClient({
  user,
  preference,
  paymentTerms,
  taxRates,
  expenseCategories,
}: {
  user: SessionUser;
  preference: SupplierPreference;
  paymentTerms: PaymentTerm[];
  taxRates: TaxRate[];
  expenseCategories: ExpenseCategory[];
}) {
  return (
    <PreferencesFormClient
      user={user}
      title="Préférences fournisseurs"
      description="Achats et factures fournisseurs."
      values={preference as unknown as Record<string, unknown>}
      fields={[
        {
          type: "select",
          name: "defaultSupplierPaymentTermId",
          label: "Condition de paiement par défaut",
          options: paymentTerms.map((t) => ({ value: t.id, label: t.name })),
        },
        {
          type: "select",
          name: "defaultSupplierTaxRateId",
          label: "TVA par défaut",
          options: taxRates.map((t) => ({ value: t.id, label: `${t.name} (${t.rate} %)` })),
        },
        {
          type: "select",
          name: "defaultExpenseCategoryId",
          label: "Catégorie de dépense par défaut",
          options: expenseCategories.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          type: "checkbox",
          name: "requireSupplierInvoiceAttachment",
          label: "Exiger une pièce jointe",
        },
        {
          type: "checkbox",
          name: "allowSupplierBankDetailsSandbox",
          label: "Autoriser coordonnées bancaires fictives",
        },
        {
          type: "select",
          name: "defaultSupplierRiskLevel",
          label: "Niveau de risque par défaut",
          options: [
            { value: "LOW", label: "Faible" },
            { value: "MEDIUM", label: "Moyen" },
            { value: "HIGH", label: "Élevé" },
          ],
        },
      ]}
      onSave={async (formData) => updateSupplierPreferenceAction(parseSupplierPreferenceForm(formData))}
    />
  );
}
