"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { DiscountType, QuoteLineType, QuoteStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { QuoteTotals } from "@/components/quotes/quote-totals";
import { calculateQuoteTotals } from "@/lib/quote-calculations";
import { isQuoteEditableWithConfirmation } from "@/lib/quote-status";
import { createQuoteAction, updateQuoteAction } from "@/server/actions/quote.actions";
import { moneyToNumber, type MoneyInput } from "@/lib/money";
import { SELECT_NONE, formOptionalValue, optionalSelectId } from "@/lib/select-constants";

type CustomerOption = {
  id: string;
  name: string;
  defaultPaymentTermsDays: number;
  contacts: { id: string; firstName: string; lastName: string; email: string | null; isPrimary: boolean }[];
  addresses: { id: string; type: string; label: string | null; addressLine1: string; city: string; isDefault: boolean }[];
};

type ItemOption = {
  id: string;
  itemNumber: string;
  name: string;
  type: string;
  salePriceExcludingTax: MoneyInput;
  defaultVatRate: MoneyInput;
  shortDescription: string | null;
  description: string | null;
  unit: { symbol: string } | null;
};

type FormLine = {
  key: string;
  itemId: string | null;
  lineType: QuoteLineType;
  position: number;
  reference: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceExcludingTax: number;
  discountType: DiscountType | null;
  discountValue: number;
  vatRate: number;
};

type OrgDefaults = {
  defaultCurrency: string;
  defaultLocale: string;
  defaultPaymentTermsDays: number;
  defaultQuoteFooter: string | null;
};

type CommercialDefaults = {
  defaultQuoteValidityDays?: number;
  defaultQuoteIntroduction?: string | null;
  defaultQuoteFooter?: string | null;
};

type QuoteFormProps = {
  mode: "create" | "edit";
  customers: CustomerOption[];
  items: ItemOption[];
  organization: OrgDefaults | null;
  commercialDefaults?: CommercialDefaults | null;
  quote?: {
    id: string;
    status: QuoteStatus;
    customerId: string;
    customerContactId: string | null;
    billingAddressId: string | null;
    shippingAddressId: string | null;
    title: string;
    subject: string | null;
    issueDate: Date;
    validUntil: Date;
    currency: string;
    language: string;
    paymentTermsDays: number;
    introductionText: string | null;
    footerText: string | null;
    internalNotes: string | null;
    customerNotes: string | null;
    globalDiscountType: DiscountType | null;
    globalDiscountValue: MoneyInput;
    shippingAmountExcludingTax: MoneyInput;
    otherFeesExcludingTax: MoneyInput;
    lines: {
      itemId: string | null;
      lineType: QuoteLineType;
      position: number;
      reference: string | null;
      name: string;
      description: string | null;
      quantity: MoneyInput;
      unit: string;
      unitPriceExcludingTax: MoneyInput;
      discountType: DiscountType | null;
      discountValue: MoneyInput;
      vatRate: MoneyInput;
    }[];
  };
};

function toDateInput(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

function newLine(position: number, partial?: Partial<FormLine>): FormLine {
  return {
    key: `line-${position}`,
    itemId: null,
    lineType: "FREE_TEXT",
    position,
    reference: "",
    name: "",
    description: "",
    quantity: 1,
    unit: "unité",
    unitPriceExcludingTax: 0,
    discountType: null,
    discountValue: 0,
    vatRate: 20,
    ...partial,
  };
}

export function QuoteForm({
  mode,
  customers,
  items,
  organization,
  commercialDefaults,
  quote,
}: QuoteFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmSentEdit, setConfirmSentEdit] = useState(false);

  const validityDays = commercialDefaults?.defaultQuoteValidityDays ?? 30;
  const today = toDateInput(new Date());
  const defaultValid = toDateInput(new Date(Date.now() + validityDays * 86400000));

  const [customerId, setCustomerId] = useState(quote?.customerId ?? customers[0]?.id ?? "");
  const [customerContactId, setCustomerContactId] = useState(
    optionalSelectId(quote?.customerContactId),
  );
  const [billingAddressId, setBillingAddressId] = useState(
    optionalSelectId(quote?.billingAddressId),
  );
  const [shippingAddressId, setShippingAddressId] = useState(
    optionalSelectId(quote?.shippingAddressId),
  );
  const [globalDiscountType, setGlobalDiscountType] = useState<string>(
    quote?.globalDiscountType ?? SELECT_NONE,
  );
  const [globalDiscountValue] = useState(moneyToNumber(quote?.globalDiscountValue ?? 0));
  const [shippingAmount] = useState(moneyToNumber(quote?.shippingAmountExcludingTax ?? 0));
  const [otherFees] = useState(moneyToNumber(quote?.otherFeesExcludingTax ?? 0));

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const initialLines: FormLine[] =
    quote?.lines.map((l, i) =>
      newLine(l.position ?? i, {
        key: `existing-${i}`,
        itemId: l.itemId,
        lineType: l.lineType,
        position: l.position,
        reference: l.reference ?? "",
        name: l.name,
        description: l.description ?? "",
        quantity: moneyToNumber(l.quantity),
        unit: l.unit,
        unitPriceExcludingTax: moneyToNumber(l.unitPriceExcludingTax),
        discountType: l.discountType,
        discountValue: moneyToNumber(l.discountValue),
        vatRate: moneyToNumber(l.vatRate),
      }),
    ) ?? [newLine(0, { lineType: "FREE_TEXT", name: "Prestation", unitPriceExcludingTax: 100 })];

  const [lines, setLines] = useState<FormLine[]>(initialLines);

  const totals = useMemo(
    () =>
      calculateQuoteTotals({
        lines: lines.map((l) => ({
          lineType: l.lineType,
          quantity: l.quantity,
          unitPriceExcludingTax: l.unitPriceExcludingTax,
          discountType: l.discountType,
          discountValue: l.discountValue,
          vatRate: l.vatRate,
        })),
        globalDiscountType:
          globalDiscountType === SELECT_NONE
            ? null
            : (globalDiscountType as DiscountType),
        globalDiscountValue,
        shippingAmountExcludingTax: shippingAmount,
        otherFeesExcludingTax: otherFees,
      }),
    [lines, globalDiscountType, globalDiscountValue, shippingAmount, otherFees],
  );

  function updateLine(index: number, patch: Partial<FormLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addCatalogLine(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setLines((prev) => [
      ...prev,
      newLine(prev.length, {
        itemId: item.id,
        lineType: item.type === "SERVICE" ? "SERVICE" : "ITEM",
        reference: item.itemNumber,
        name: item.name,
        description: item.shortDescription ?? item.description ?? "",
        unitPriceExcludingTax: moneyToNumber(item.salePriceExcludingTax),
        vatRate: moneyToNumber(item.defaultVatRate),
        unit: item.unit?.symbol ?? "unité",
      }),
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, position: i })));
  }

  async function handleSubmit(formData: FormData, asDraft = true) {
    if (quote && isQuoteEditableWithConfirmation(quote.status) && !confirmSentEdit) {
      toast.error("Confirmez la modification d'un devis déjà envoyé.");
      return;
    }

    setLoading(true);
    formData.set("customerId", customerId);
    formData.set("customerContactId", formOptionalValue(customerContactId));
    formData.set("billingAddressId", formOptionalValue(billingAddressId));
    formData.set("shippingAddressId", formOptionalValue(shippingAddressId));
    formData.set("globalDiscountType", formOptionalValue(globalDiscountType));
    formData.set(
      "lines",
      JSON.stringify(
        lines.map((l, i) => ({
          itemId: l.itemId,
          lineType: l.lineType,
          position: i,
          reference: l.reference || null,
          name: l.name,
          description: l.description || null,
          quantity: l.quantity,
          unit: l.unit,
          unitPriceExcludingTax: l.unitPriceExcludingTax,
          discountType: l.discountType,
          discountValue: l.discountValue,
          vatRate: l.vatRate,
        })),
      ),
    );
    if (confirmSentEdit) formData.set("confirmSentEdit", "true");

    const result =
      mode === "create"
        ? await createQuoteAction(formData)
        : await updateQuoteAction(quote!.id, formData);

    setLoading(false);

    if (result.success && result.quoteId) {
      toast.success(mode === "create" ? "Devis créé" : "Devis enregistré");
      router.push(`/quotes/${result.quoteId}`);
      router.refresh();
    } else if (result.error === "CONFIRM_SENT_EDIT") {
      setConfirmSentEdit(true);
      toast.warning("Ce devis a déjà été envoyé. Cochez la confirmation pour continuer.");
    } else {
      toast.error(result.error ?? "Erreur lors de l'enregistrement");
    }

    void asDraft;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select
              value={customerId}
              onValueChange={setCustomerId}
              disabled={mode === "edit" && quote?.status !== "DRAFT"}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Contact</Label>
            <Select value={customerContactId} onValueChange={setCustomerContactId}>
              <SelectTrigger><SelectValue placeholder="Contact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE}>— Aucun —</SelectItem>
                {selectedCustomer?.contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Adresse facturation</Label>
            <Select value={billingAddressId} onValueChange={setBillingAddressId}>
              <SelectTrigger><SelectValue placeholder="Adresse" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE}>— Aucune —</SelectItem>
                {selectedCustomer?.addresses.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label ?? a.addressLine1}, {a.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Adresse livraison</Label>
            <Select value={shippingAddressId} onValueChange={setShippingAddressId}>
              <SelectTrigger><SelectValue placeholder="Adresse" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE}>— Aucune —</SelectItem>
                {selectedCustomer?.addresses.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label ?? a.addressLine1}, {a.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Titre du devis *</Label>
            <Input id="title" name="title" defaultValue={quote?.title} required minLength={2} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="subject">Sujet</Label>
            <Input id="subject" name="subject" defaultValue={quote?.subject ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issueDate">Date d{"'"}émission *</Label>
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              defaultValue={quote ? toDateInput(quote.issueDate) : today}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="validUntil">Validité *</Label>
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              defaultValue={quote ? toDateInput(quote.validUntil) : defaultValid}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Input
              id="currency"
              name="currency"
              defaultValue={quote?.currency ?? organization?.defaultCurrency ?? "EUR"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentTermsDays">Délai paiement (jours)</Label>
            <Input
              id="paymentTermsDays"
              name="paymentTermsDays"
              type="number"
              min={0}
              max={120}
              defaultValue={
                quote?.paymentTermsDays ??
                selectedCustomer?.defaultPaymentTermsDays ??
                organization?.defaultPaymentTermsDays ??
                30
              }
            />
          </div>
          <input type="hidden" name="language" value={quote?.language ?? organization?.defaultLocale ?? "fr-FR"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Textes</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="introductionText">Introduction</Label>
            <Textarea
              id="introductionText"
              name="introductionText"
              rows={3}
              defaultValue={
                quote?.introductionText ?? commercialDefaults?.defaultQuoteIntroduction ?? ""
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerNotes">Notes client</Label>
            <Textarea id="customerNotes" name="customerNotes" rows={2} defaultValue={quote?.customerNotes ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerText">Conditions / pied de page</Label>
            <Textarea
              id="footerText"
              name="footerText"
              rows={2}
              defaultValue={
                quote?.footerText ??
                commercialDefaults?.defaultQuoteFooter ??
                organization?.defaultQuoteFooter ??
                ""
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internalNotes">Notes internes</Label>
            <Textarea id="internalNotes" name="internalNotes" rows={2} defaultValue={quote?.internalNotes ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lignes du devis</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select onValueChange={addCatalogLine}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Depuis catalogue" /></SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.itemNumber} — {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, newLine(p.length)])}>
              <Plus className="h-4 w-4" /> Ligne libre
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((p) => [...p, newLine(p.length, { lineType: "SECTION", name: "Section", unitPriceExcludingTax: 0 })])
              }
            >
              Section
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((p) => [...p, newLine(p.length, { lineType: "COMMENT", name: "Commentaire", unitPriceExcludingTax: 0 })])
              }
            >
              Commentaire
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, index) => {
            const isNonBillable = line.lineType === "SECTION" || line.lineType === "COMMENT";
            return (
              <div key={line.key} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-muted-foreground)]">
                    Ligne {index + 1} — {line.lineType}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Input
                    placeholder="Libellé *"
                    value={line.name}
                    onChange={(e) => updateLine(index, { name: e.target.value })}
                    className="md:col-span-2"
                  />
                  {!isNonBillable && (
                    <>
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        placeholder="Qté"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Prix HT"
                        value={line.unitPriceExcludingTax}
                        onChange={(e) => updateLine(index, { unitPriceExcludingTax: Number(e.target.value) })}
                      />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="TVA %"
                        value={line.vatRate}
                        onChange={(e) => updateLine(index, { vatRate: Number(e.target.value) })}
                      />
                      <Select
                        value={line.discountType ?? SELECT_NONE}
                        onValueChange={(v) =>
                          updateLine(index, {
                            discountType:
                              v === SELECT_NONE ? null : (v as DiscountType),
                          })
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Remise" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SELECT_NONE}>Aucune</SelectItem>
                          <SelectItem value="PERCENTAGE">%</SelectItem>
                          <SelectItem value="FIXED_AMOUNT">Montant</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Valeur remise"
                        value={line.discountValue}
                        onChange={(e) => updateLine(index, { discountValue: Number(e.target.value) })}
                      />
                    </>
                  )}
                  <Input
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(index, { description: e.target.value })}
                    className="md:col-span-4"
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Remise globale et frais</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Type remise globale</Label>
              <Select value={globalDiscountType} onValueChange={setGlobalDiscountType}>
                <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE}>Aucune</SelectItem>
                  <SelectItem value="PERCENTAGE">Pourcentage</SelectItem>
                  <SelectItem value="FIXED_AMOUNT">Montant fixe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="globalDiscountValue">Valeur remise</Label>
              <Input
                id="globalDiscountValue"
                name="globalDiscountValue"
                type="number"
                min={0}
                defaultValue={moneyToNumber(quote?.globalDiscountValue ?? 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingAmountExcludingTax">Livraison HT</Label>
              <Input
                id="shippingAmountExcludingTax"
                name="shippingAmountExcludingTax"
                type="number"
                min={0}
                step={0.01}
                defaultValue={moneyToNumber(quote?.shippingAmountExcludingTax ?? 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otherFeesExcludingTax">Autres frais HT</Label>
              <Input
                id="otherFeesExcludingTax"
                name="otherFeesExcludingTax"
                type="number"
                min={0}
                step={0.01}
                defaultValue={moneyToNumber(quote?.otherFeesExcludingTax ?? 0)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Totaux</CardTitle></CardHeader>
          <CardContent>
            <QuoteTotals totals={totals} currency={quote?.currency ?? "EUR"} />
          </CardContent>
        </Card>
      </div>

      {quote && isQuoteEditableWithConfirmation(quote.status) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmSentEdit}
              onChange={(e) => setConfirmSentEdit(e.target.checked)}
            />
            Je confirme la modification de ce devis déjà envoyé.
          </label>
        </div>
      )}

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : mode === "create" ? "Créer le devis" : "Enregistrer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
