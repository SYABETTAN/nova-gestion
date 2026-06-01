"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { DiscountType, InvoiceLineType, InvoiceStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { InvoiceTotals } from "@/components/invoices/invoice-totals";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { createInvoiceAction, updateInvoiceAction } from "@/server/actions/invoice.actions";
import { moneyToNumber, type MoneyInput } from "@/lib/money";

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
  lineType: InvoiceLineType;
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
  defaultInvoiceFooter: string | null;
};

type InvoiceFormProps = {
  mode: "create" | "edit";
  customers: CustomerOption[];
  items: ItemOption[];
  organization: OrgDefaults | null;
  invoice?: {
    id: string;
    status: InvoiceStatus;
    type: string;
    customerId: string;
    customerContactId: string | null;
    billingAddressId: string | null;
    shippingAddressId: string | null;
    title: string;
    subject: string | null;
    issueDate: Date;
    dueDate: Date;
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
    amountPaid: MoneyInput;
    lines: {
      itemId: string | null;
      lineType: InvoiceLineType;
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
    key: `line-${Date.now()}-${position}`,
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

export function InvoiceForm({ mode, customers, items, organization, invoice }: InvoiceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [invoiceType, setInvoiceType] = useState(invoice?.type ?? "STANDARD");

  const today = toDateInput(new Date());
  const defaultDue = toDateInput(new Date(Date.now() + 30 * 86400000));

  const [customerId, setCustomerId] = useState(invoice?.customerId ?? customers[0]?.id ?? "");
  const [customerContactId, setCustomerContactId] = useState(invoice?.customerContactId ?? "");
  const [billingAddressId, setBillingAddressId] = useState(invoice?.billingAddressId ?? "");
  const [shippingAddressId, setShippingAddressId] = useState(invoice?.shippingAddressId ?? "");
  const [globalDiscountType, setGlobalDiscountType] = useState<string>(invoice?.globalDiscountType ?? "");
  const [globalDiscountValue, setGlobalDiscountValue] = useState(moneyToNumber(invoice?.globalDiscountValue ?? 0));
  const [shippingAmount, setShippingAmount] = useState(moneyToNumber(invoice?.shippingAmountExcludingTax ?? 0));
  const [otherFees, setOtherFees] = useState(moneyToNumber(invoice?.otherFeesExcludingTax ?? 0));
  const [amountPaid, setAmountPaid] = useState(moneyToNumber(invoice?.amountPaid ?? 0));

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const initialLines: FormLine[] =
    invoice?.lines.map((l, i) =>
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
      calculateInvoiceTotals({
        lines: lines.map((l) => ({
          lineType: l.lineType,
          quantity: l.quantity,
          unitPriceExcludingTax: l.unitPriceExcludingTax,
          discountType: l.discountType,
          discountValue: l.discountValue,
          vatRate: l.vatRate,
        })),
        globalDiscountType: (globalDiscountType || null) as DiscountType | null,
        globalDiscountValue,
        shippingAmountExcludingTax: shippingAmount,
        otherFeesExcludingTax: otherFees,
        amountPaid,
      }),
    [lines, globalDiscountType, globalDiscountValue, shippingAmount, otherFees, amountPaid],
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

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("customerId", customerId);
    formData.set("customerContactId", customerContactId);
    formData.set("billingAddressId", billingAddressId);
    formData.set("shippingAddressId", shippingAddressId);
    formData.set("globalDiscountType", globalDiscountType);
    formData.set("type", invoiceType);
    formData.set("globalDiscountValue", String(globalDiscountValue));
    formData.set("shippingAmountExcludingTax", String(shippingAmount));
    formData.set("otherFeesExcludingTax", String(otherFees));
    formData.set("amountPaid", String(amountPaid));
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

    const result =
      mode === "create"
        ? await createInvoiceAction(formData)
        : await updateInvoiceAction(invoice!.id, formData);

    setLoading(false);

    if (result.success && result.invoiceId) {
      toast.success(mode === "create" ? "Facture créée" : "Facture enregistrée");
      router.push(`/invoices/${result.invoiceId}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de l'enregistrement");
    }
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
              disabled={mode === "edit" && invoice?.status !== "DRAFT"}
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
                <SelectItem value="">— Aucun —</SelectItem>
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
                <SelectItem value="">— Aucune —</SelectItem>
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
                <SelectItem value="">— Aucune —</SelectItem>
                {selectedCustomer?.addresses.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label ?? a.addressLine1}, {a.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type de facture</Label>
            <Select value={invoiceType} onValueChange={setInvoiceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="DEPOSIT">Acompte</SelectItem>
                <SelectItem value="FINAL">Finale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Titre de la facture *</Label>
            <Input id="title" name="title" defaultValue={invoice?.title} required minLength={2} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="subject">Sujet</Label>
            <Input id="subject" name="subject" defaultValue={invoice?.subject ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issueDate">Date d{"'"}émission *</Label>
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              defaultValue={invoice ? toDateInput(invoice.issueDate) : today}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Validité *</Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={invoice ? toDateInput(invoice.dueDate) : defaultDue}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Input
              id="currency"
              name="currency"
              defaultValue={invoice?.currency ?? organization?.defaultCurrency ?? "EUR"}
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
                invoice?.paymentTermsDays ??
                selectedCustomer?.defaultPaymentTermsDays ??
                organization?.defaultPaymentTermsDays ??
                30
              }
            />
          </div>
          <input type="hidden" name="language" value={invoice?.language ?? organization?.defaultLocale ?? "fr-FR"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Textes</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="introductionText">Introduction</Label>
            <Textarea id="introductionText" name="introductionText" rows={3} defaultValue={invoice?.introductionText ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerNotes">Notes client</Label>
            <Textarea id="customerNotes" name="customerNotes" rows={2} defaultValue={invoice?.customerNotes ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerText">Conditions / pied de page</Label>
            <Textarea
              id="footerText"
              name="footerText"
              rows={2}
              defaultValue={invoice?.footerText ?? organization?.defaultInvoiceFooter ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internalNotes">Notes internes</Label>
            <Textarea id="internalNotes" name="internalNotes" rows={2} defaultValue={invoice?.internalNotes ?? ""} />
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
                        value={line.discountType ?? ""}
                        onValueChange={(v) =>
                          updateLine(index, { discountType: (v || null) as DiscountType | null })
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Remise" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Aucune</SelectItem>
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
                  <SelectItem value="">Aucune</SelectItem>
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
                defaultValue={moneyToNumber(invoice?.globalDiscountValue ?? 0)}
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
                defaultValue={moneyToNumber(invoice?.shippingAmountExcludingTax ?? 0)}
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
                defaultValue={moneyToNumber(invoice?.otherFeesExcludingTax ?? 0)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Totaux</CardTitle></CardHeader>
          <CardContent>
            <InvoiceTotals totals={totals} currency={invoice?.currency ?? "EUR"} showPayment />
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : mode === "create" ? "Créer la facture" : "Enregistrer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
