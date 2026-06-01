"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { SupplierInvoiceStatus } from "@/components/supplier-invoices/supplier-invoice-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SupplierInvoiceTotals } from "@/components/supplier-invoices/supplier-invoice-totals";
import { calculateSupplierInvoiceTotals } from "@/lib/supplier-invoice-calculations";
import { SUPPLIER_INVOICE_TYPE_LABELS } from "@/lib/supplier-invoice-status";
import {
  createSupplierInvoiceAction,
  updateSupplierInvoiceAction,
} from "@/server/actions/supplier-invoice.actions";
import { moneyToNumber, type MoneyInput } from "@/lib/money";

type SupplierOption = {
  id: string;
  name: string;
  supplierNumber: string;
  defaultPaymentTermsDays: number;
  defaultVatRate: MoneyInput;
  currency: string;
};

type ExpenseCategoryOption = {
  id: string;
  name: string;
};

type FormLine = {
  key: string;
  expenseCategoryId: string;
  position: number;
  reference: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceExcludingTax: number;
  discountAmount: number;
  vatRate: number;
};

type SupplierInvoiceFormProps = {
  mode: "create" | "edit";
  suppliers: SupplierOption[];
  expenseCategories: ExpenseCategoryOption[];
  prefillSupplierId?: string;
  invoice?: {
    id: string;
    status: SupplierInvoiceStatus;
    type: string;
    supplierId: string;
    supplierReference: string | null;
    title: string;
    description: string | null;
    issueDate: Date;
    receivedDate: Date;
    dueDate: Date;
    currency: string;
    paymentTermsDays: number;
    defaultVatRate: MoneyInput;
    expenseCategoryId: string | null;
    paymentMethodPlaceholder: string | null;
    internalNotes: string | null;
    amountPaid: MoneyInput;
    lines: {
      expenseCategoryId: string | null;
      position: number;
      reference: string | null;
      name: string;
      description: string | null;
      quantity: MoneyInput;
      unit: string;
      unitPriceExcludingTax: MoneyInput;
      discountAmount: MoneyInput;
      vatRate: MoneyInput;
    }[];
  };
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Virement",
  CARD: "Carte",
  CHECK: "Chèque",
  CASH: "Espèces",
  DIRECT_DEBIT: "Prélèvement",
  OTHER: "Autre",
};

function toDateInput(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

function newLine(position: number, partial?: Partial<FormLine>): FormLine {
  return {
    key: `line-${Date.now()}-${position}`,
    expenseCategoryId: "",
    position,
    reference: "",
    name: "",
    description: "",
    quantity: 1,
    unit: "unité",
    unitPriceExcludingTax: 0,
    discountAmount: 0,
    vatRate: 20,
    ...partial,
  };
}

export function SupplierInvoiceForm({
  mode,
  suppliers,
  expenseCategories,
  prefillSupplierId,
  invoice,
}: SupplierInvoiceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [invoiceType, setInvoiceType] = useState(invoice?.type ?? "STANDARD");

  const today = toDateInput(new Date());
  const defaultDue = toDateInput(new Date(Date.now() + 30 * 86400000));

  const [supplierId, setSupplierId] = useState(
    invoice?.supplierId ?? prefillSupplierId ?? suppliers[0]?.id ?? "",
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState(invoice?.expenseCategoryId ?? "");
  const [paymentMethod, setPaymentMethod] = useState(invoice?.paymentMethodPlaceholder ?? "");

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const initialLines: FormLine[] =
    invoice?.lines.map((l, i) =>
      newLine(l.position ?? i, {
        key: `existing-${i}`,
        expenseCategoryId: l.expenseCategoryId ?? "",
        position: l.position,
        reference: l.reference ?? "",
        name: l.name,
        description: l.description ?? "",
        quantity: moneyToNumber(l.quantity),
        unit: l.unit,
        unitPriceExcludingTax: moneyToNumber(l.unitPriceExcludingTax),
        discountAmount: moneyToNumber(l.discountAmount),
        vatRate: moneyToNumber(l.vatRate),
      }),
    ) ?? [
      newLine(0, {
        name: "Prestation",
        unitPriceExcludingTax: 100,
        vatRate: moneyToNumber(selectedSupplier?.defaultVatRate ?? 20),
      }),
    ];

  const [lines, setLines] = useState<FormLine[]>(initialLines);

  const amountPaid = moneyToNumber(invoice?.amountPaid ?? 0);

  const totals = useMemo(
    () =>
      calculateSupplierInvoiceTotals(
        lines.map((l) => ({
          quantity: l.quantity,
          unitPriceExcludingTax: l.unitPriceExcludingTax,
          discountAmount: l.discountAmount,
          vatRate: l.vatRate,
        })),
        amountPaid,
      ),
    [lines, amountPaid],
  );

  function updateLine(index: number, patch: Partial<FormLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, position: i })));
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("supplierId", supplierId);
    formData.set("type", invoiceType);
    formData.set("expenseCategoryId", expenseCategoryId);
    formData.set("paymentMethodPlaceholder", paymentMethod);
    formData.set(
      "lines",
      JSON.stringify(
        lines.map((l, i) => ({
          expenseCategoryId: l.expenseCategoryId || null,
          position: i,
          reference: l.reference || null,
          name: l.name,
          description: l.description || null,
          quantity: l.quantity,
          unit: l.unit,
          unitPriceExcludingTax: l.unitPriceExcludingTax,
          discountAmount: l.discountAmount,
          vatRate: l.vatRate,
        })),
      ),
    );
    const result =
      mode === "create"
        ? await createSupplierInvoiceAction(formData)
        : await updateSupplierInvoiceAction(invoice!.id, formData);

    setLoading(false);

    if (result.success && "supplierInvoiceId" in result && result.supplierInvoiceId) {
      toast.success(mode === "create" ? "Facture fournisseur créée" : "Facture enregistrée");
      router.push(`/supplier-invoices/${result.supplierInvoiceId}`);
      router.refresh();
    } else if (result.success) {
      toast.success("Facture enregistrée");
      router.push(`/supplier-invoices/${invoice!.id}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de l'enregistrement");
    }
  }

  const currency = invoice?.currency ?? selectedSupplier?.currency ?? "EUR";
  const defaultVat = moneyToNumber(invoice?.defaultVatRate ?? selectedSupplier?.defaultVatRate ?? 20);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Fournisseur *</Label>
            <Select
              value={supplierId}
              onValueChange={setSupplierId}
              disabled={mode === "edit" && invoice?.status !== "DRAFT"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un fournisseur" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.supplierNumber} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplierReference">Référence fournisseur</Label>
            <Input
              id="supplierReference"
              name="supplierReference"
              defaultValue={invoice?.supplierReference ?? ""}
              placeholder="N° facture du fournisseur"
            />
          </div>
          <div className="space-y-2">
            <Label>Type de facture</Label>
            <Select value={invoiceType} onValueChange={setInvoiceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SUPPLIER_INVOICE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Catégorie de dépense</Label>
            <Select value={expenseCategoryId} onValueChange={setExpenseCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Aucune —</SelectItem>
                {expenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Titre *</Label>
            <Input id="title" name="title" defaultValue={invoice?.title} required minLength={2} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={invoice?.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issueDate">Date de facture *</Label>
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              defaultValue={invoice ? toDateInput(invoice.issueDate) : today}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receivedDate">Date de réception *</Label>
            <Input
              id="receivedDate"
              name="receivedDate"
              type="date"
              defaultValue={invoice ? toDateInput(invoice.receivedDate) : today}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Date d{"'"}échéance *</Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={invoice ? toDateInput(invoice.dueDate) : defaultDue}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentTermsDays">Délai de paiement (jours)</Label>
            <Input
              id="paymentTermsDays"
              name="paymentTermsDays"
              type="number"
              min={0}
              max={120}
              defaultValue={
                invoice?.paymentTermsDays ??
                selectedSupplier?.defaultPaymentTermsDays ??
                30
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Input id="currency" name="currency" defaultValue={currency} maxLength={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultVatRate">TVA par défaut (%)</Label>
            <Input
              id="defaultVatRate"
              name="defaultVatRate"
              type="number"
              min={0}
              max={100}
              defaultValue={defaultVat}
            />
          </div>
          <div className="space-y-2">
            <Label>Mode de paiement (placeholder)</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Non renseigné" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Non renseigné —</SelectItem>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lignes</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLines((p) => [
                ...p,
                newLine(p.length, {
                  vatRate: moneyToNumber(selectedSupplier?.defaultVatRate ?? defaultVat),
                }),
              ])
            }
          >
            <Plus className="h-4 w-4" /> Ajouter une ligne
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, index) => (
            <div key={line.key} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-muted-foreground)]">
                  Ligne {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLine(index)}
                  disabled={lines.length <= 1}
                >
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
                <Input
                  placeholder="Référence"
                  value={line.reference}
                  onChange={(e) => updateLine(index, { reference: e.target.value })}
                />
                <Select
                  value={line.expenseCategoryId}
                  onValueChange={(v) => updateLine(index, { expenseCategoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Catégorie ligne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Aucune —</SelectItem>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="Qté"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                />
                <Input
                  placeholder="Unité"
                  value={line.unit}
                  onChange={(e) => updateLine(index, { unit: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Prix HT"
                  value={line.unitPriceExcludingTax}
                  onChange={(e) =>
                    updateLine(index, { unitPriceExcludingTax: Number(e.target.value) })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Remise €"
                  value={line.discountAmount}
                  onChange={(e) => updateLine(index, { discountAmount: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="TVA %"
                  value={line.vatRate}
                  onChange={(e) => updateLine(index, { vatRate: Number(e.target.value) })}
                />
                <Input
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                  className="md:col-span-4"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes internes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="internalNotes"
            name="internalNotes"
            rows={3}
            defaultValue={invoice?.internalNotes ?? ""}
            placeholder="Notes visibles uniquement en interne"
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Totaux calculés</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierInvoiceTotals totals={totals} currency={currency} showPayment={mode === "edit"} />
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Enregistrement..."
            : mode === "create"
              ? "Créer la facture fournisseur"
              : "Enregistrer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
