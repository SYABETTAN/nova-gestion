"use client";

import { PreferencesFormClient } from "@/components/settings/preferences-form-client";
import { parseAccountingPreferenceForm } from "@/lib/settings-form";
import type { SessionUser } from "@/lib/permissions";
import { updateAccountingPreferenceAction } from "@/server/actions/settings.actions";
import type { AccountingJournal, AccountingPreference } from "@prisma/client";

export function AccountingPreferencesClient({
  user,
  preference,
  journals,
}: {
  user: SessionUser;
  preference: AccountingPreference;
  journals: AccountingJournal[];
}) {
  const journalOptions = journals.map((j) => ({ value: j.id, label: `${j.code} — ${j.name}` }));

  return (
    <PreferencesFormClient
      user={user}
      title="Préférences comptables"
      description="Journaux et génération automatique."
      values={preference as unknown as Record<string, unknown>}
      fields={[
        { type: "select", name: "defaultSalesJournalId", label: "Journal ventes", options: journalOptions },
        { type: "select", name: "defaultPurchaseJournalId", label: "Journal achats", options: journalOptions },
        { type: "select", name: "defaultBankJournalId", label: "Journal banque", options: journalOptions },
        { type: "select", name: "defaultCashJournalId", label: "Journal caisse", options: journalOptions },
        { type: "select", name: "defaultMiscJournalId", label: "Journal OD", options: journalOptions },
        {
          type: "checkbox",
          name: "autoGenerateEntriesFromCustomerInvoices",
          label: "Écritures auto depuis factures clients",
        },
        {
          type: "checkbox",
          name: "autoGenerateEntriesFromCustomerPayments",
          label: "Écritures auto depuis paiements",
        },
        {
          type: "checkbox",
          name: "autoGenerateEntriesFromSupplierInvoices",
          label: "Écritures auto depuis factures fournisseurs",
        },
        {
          type: "checkbox",
          name: "requireBalancedEntriesForValidation",
          label: "Exiger équilibre pour validation",
        },
        {
          type: "checkbox",
          name: "allowDraftUnbalancedEntries",
          label: "Autoriser brouillons non équilibrés",
        },
      ]}
      onSave={async (formData) => updateAccountingPreferenceAction(parseAccountingPreferenceForm(formData))}
    />
  );
}
